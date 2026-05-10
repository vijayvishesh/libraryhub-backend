import * as bcrypt from 'bcrypt';
import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { AuthRepository } from '../repositories/auth.repositories';
import { LibraryRepository } from '../repositories/library.repository';
import { LibrarySeatRepository } from '../repositories/librarySeat.repository';
import { MemberInviteLinkRepository } from '../repositories/memberInviteLink.repository';
import { MemberInviteSubmissionRepository } from '../repositories/memberInviteSubmission.repository';
import { MemberRepository } from '../repositories/member.repository';
import {
  BulkReviewRequest,
  ListSubmissionsQueryRequest,
  ReviewSubmissionRequest,
  SubmitInviteFormRequest,
  UpdateSubmissionRequest,
} from '../controllers/requests/memberInviteSubmission.request';
import { SubmissionRecord } from '../repositories/types/memberInviteSubmission.repository.types';
import { BookingRepository } from '../repositories/booking.repository';

@Service()
export class MemberInviteSubmissionService {
  constructor(
    private readonly submissionRepository: MemberInviteSubmissionRepository,
    private readonly inviteLinkRepository: MemberInviteLinkRepository,
    private readonly memberRepository: MemberRepository,
    private readonly libraryRepository: LibraryRepository,
    private readonly librarySeatRepository: LibrarySeatRepository,
    private readonly authRepository: AuthRepository,
    private readonly bookingRepository: BookingRepository,
  ) {}


public async submitForm(
  token: string,
  payload: SubmitInviteFormRequest,
): Promise<SubmissionRecord> {
  // 1. Validate invite link
  const link = await this.inviteLinkRepository.findValidLinkByToken(token);
  if (!link) throw new HttpError(404, 'INVITE_LINK_INVALID_OR_EXPIRED');

  // 2. Fetch library early — needed for planAmount resolution + booking
  const library = await this.libraryRepository.findLibraryById(link.libraryId);
  if (!library) throw new HttpError(404, 'LIBRARY_NOT_FOUND');

  // 3. Validate seat if provided
  if (payload.seatId) {
    await this.validateSeat(link.libraryId, payload.seatId, payload.gender, payload.slotId);
  }

  const mobileNo = payload.mobileNo.trim();

  // 4. Compute smart flags
  const existingStudent = await this.authRepository.findStudentByPhone(mobileNo);
  const isNewUser = !existingStudent;

  const existingMember = await this.memberRepository.findMemberByLibraryMobileOrAadhar(
    link.libraryId,
    mobileNo,
  );
  if (existingMember) {
    throw new HttpError(409, 'PHONE_ALREADY_MEMBER_OF_LIBRARY');
  }

  const isExistingMember = false;
  // const isDuplicate = false;

  let hasPendingFee = false;
  let pendingFeeAmount: number | null = null;
  let previousEndDate: string | null = null;

  if (existingStudent) {
    const allMemberRecords = await this.memberRepository.findAllMembersByPhone(mobileNo);
    const pendingRecord = allMemberRecords.find(
      m => m.status === 'pending' && (m.planAmount ?? 0) > 0,
    );
    if (pendingRecord) {
      hasPendingFee = true;
      pendingFeeAmount = pendingRecord.planAmount ?? null;
    }
    const sorted = allMemberRecords
      .filter(m => m.endDate)
      .sort((a, b) => (b.endDate! > a.endDate! ? 1 : -1));
    if (sorted.length > 0) {
      previousEndDate = sorted[0].endDate;
    }
  }

  // 5. Find or create student account
  let student = existingStudent;
  if (!student) {
    const tempPassword = await bcrypt.hash(
      `invite_${mobileNo}_${Date.now()}`,
      10,
    );
    student = await this.authRepository.createStudent({
      name: payload.fullName.trim(),
      phone: mobileNo,
      gender: payload.gender,
      password: tempPassword,
      isPhoneVerified: false,
      hasJoinedLibrary: true,
      role: 'STUDENT',
    });
  }

  // 6. Calculate duration from date range
  const start = new Date(payload.startDate);
  const end = new Date(payload.endDate);
  const diffMs = end.getTime() - start.getTime();
  const duration = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30)));

  // 7. Resolve planAmount from library slot config
  const resolvedPlanAmount = this.resolvePlanAmount(
    library.slots ?? [],
    payload.slotId,
    duration,
  );

  // 8. Find slot info for booking
  const slotInfo = (library.slots ?? []).find(s => s.slotType === payload.slotId);

  // 9. Create booking entry so approval flow works
  let bookingId: string | null = null;
  if (payload.seatId) {
    try {
      const booking = await this.bookingRepository.createInviteBooking({
        libraryId: link.libraryId,
        studentId: student.id,
        libraryName: library.name ?? '',
        libraryAddress: library.address ?? '',
        slotType: payload.slotId ?? 'fullday',
        slotName: slotInfo?.name ?? 'Full Day',
        slotStartTime: slotInfo?.startTime ?? '06:00',
        slotEndTime: slotInfo?.endTime ?? '22:00',
        seatId: payload.seatId.trim(),
        sectionId: null,
        duration,
        startDate: payload.startDate,
        validUntil: payload.endDate,
        amount: resolvedPlanAmount ?? 0,
      });
      bookingId = booking.id;
    } catch (bookingError) {
      console.error('Failed to create booking for invite submission:', bookingError);
    }
  }

  // 10. Create member record with resolved planAmount
  const member = await this.memberRepository.createMember({
    fullName: payload.fullName.trim(),
    mobileNo,
    aadharId: null,
    studentId: student.id,
    email: null,
    duration,
    libraryId: link.libraryId,
    seatId: payload.seatId?.trim() ?? null,
    slotId: payload.slotId?.trim() ?? null,
    status: 'pending',
    planAmount: resolvedPlanAmount,
    startDate: payload.startDate,
    endDate: payload.endDate,
    bookingId,
    paidAt: null,
    notes: null,
    isInviteSubmission: true,
  });

  // 11. Save submission with all flags
  const submission = await this.submissionRepository.create({
    inviteLinkId: link.id,
    inviteLinkToken: token,
    libraryId: link.libraryId,
    ownerId: link.ownerId,
    fullName: payload.fullName.trim(),
    mobileNo,
    gender: payload.gender,
    startDate: payload.startDate,
    endDate: payload.endDate,
    seatId: payload.seatId?.trim() ?? null,
    slotId: payload.slotId?.trim() ?? null,
    isInviteSubmission: true,
    isNewUser,
    isExistingMember,
    hasPendingFee,
    pendingFeeAmount,
    previousEndDate,
    isDuplicate: false,
    bookingId,
  });

  // 12. Update submission with memberId and studentId
  await this.submissionRepository.update(submission.id, link.libraryId, {
    memberId: member.id,
    studentId: student.id,
  });

  return {
    ...submission,
    memberId: member.id,
    studentId: student.id,
  };
}

  // ── OWNER: List submissions for their library ────────────────────────────
  public async listSubmissions(
    ownerId: string,
    query: ListSubmissionsQueryRequest,
  ): Promise<{ submissions: SubmissionRecord[]; total: number; page: number; limit: number }> {
    const library = await this.getOwnerLibraryOrThrow(ownerId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const result = await this.submissionRepository.list({
      libraryId: library.id,
      status: query.status,
      page,
      limit,
    });

    return { ...result, page, limit };
  }

  // ── OWNER: Edit a pending submission ────────────────────────────────────
  public async updateSubmission(
    ownerId: string,
    submissionId: string,
    payload: UpdateSubmissionRequest,
  ): Promise<SubmissionRecord> {
    const library = await this.getOwnerLibraryOrThrow(ownerId);
    const submission = await this.submissionRepository.findByIdAndLibrary(submissionId, library.id);
    if (!submission) throw new NotFoundError('SUBMISSION_NOT_FOUND');
    if (submission.status !== 'pending') throw new HttpError(409, 'SUBMISSION_ALREADY_REVIEWED');

    // Validate seat if changing
    if (payload.seatId && payload.seatId !== submission.seatId) {
      await this.validateSeat(
        library.id,
        payload.seatId,
        payload.gender ?? submission.gender,
        payload.slotId ?? submission.slotId ?? undefined,
      );
    }

    const updated = await this.submissionRepository.update(submissionId, library.id, {
      fullName: payload.fullName?.trim(),
      mobileNo: payload.mobileNo?.trim(),
      gender: payload.gender,
      startDate: payload.startDate,
      endDate: payload.endDate,
      seatId: payload.seatId?.trim() ?? undefined,
      slotId: payload.slotId?.trim() ?? undefined,
    });

    if (!updated) throw new NotFoundError('SUBMISSION_NOT_FOUND');
    return updated;
  }

  // ── OWNER: Approve or reject a single submission ─────────────────────────
  public async reviewSubmission(
    ownerId: string,
    submissionId: string,
    payload: ReviewSubmissionRequest,
  ): Promise<SubmissionRecord> {
    const library = await this.getOwnerLibraryOrThrow(ownerId);
    const submission = await this.submissionRepository.findByIdAndLibrary(submissionId, library.id);
    if (!submission) throw new NotFoundError('SUBMISSION_NOT_FOUND');
    if (submission.status !== 'pending') throw new HttpError(409, 'SUBMISSION_ALREADY_REVIEWED');

    if (payload.action === 'rejected') {
      const updated = await this.submissionRepository.update(submissionId, library.id, {
        status: 'rejected',
        rejectionReason: payload.rejectionReason ?? null,
        reviewedAt: new Date(),
        reviewedBy: ownerId,
      });
      if (!updated) throw new NotFoundError('SUBMISSION_NOT_FOUND');
      return updated;
    }

    // Approve — create student + member
    return this.processApproval(submission, ownerId, library.id);
  }

  // ── OWNER: Bulk approve / reject ────────────────────────────────────────
  public async bulkReview(
    ownerId: string,
    payload: BulkReviewRequest,
  ): Promise<{ processed: number; failed: number }> {
    const library = await this.getOwnerLibraryOrThrow(ownerId);

    if (payload.action === 'rejected') {
      const count = await this.submissionRepository.bulkUpdateStatus(
        payload.ids,
        library.id,
        'rejected',
        ownerId,
        payload.rejectionReason,
      );
      return { processed: count, failed: payload.ids.length - count };
    }

    // Bulk approve — process each one
    let processed = 0;
    let failed = 0;

    await Promise.allSettled(
      payload.ids.map(async id => {
        try {
          const submission = await this.submissionRepository.findByIdAndLibrary(id, library.id);
          if (!submission || submission.status !== 'pending') { failed++; return; }
          await this.processApproval(submission, ownerId, library.id);
          processed++;
        } catch {
          failed++;
        }
      }),
    );

    return { processed, failed };
  }

  // ── OWNER: Approve all pending at once ───────────────────────────────────
  public async approveAll(
    ownerId: string,
  ): Promise<{ processed: number; failed: number }> {
    const library = await this.getOwnerLibraryOrThrow(ownerId);
    const pending = await this.submissionRepository.findAllPendingByLibrary(library.id);

    let processed = 0;
    let failed = 0;

    // Process sequentially to avoid race conditions on seat assignments
    for (const submission of pending) {
      try {
        await this.processApproval(submission, ownerId, library.id);
        processed++;
      } catch {
        failed++;
      }
    }

    return { processed, failed };
  }

  // ── CORE: Process a single approval ─────────────────────────────────────
  private async processApproval(
    submission: SubmissionRecord,
    ownerId: string,
    libraryId: string,
  ): Promise<SubmissionRecord> {

    // 1. Validate seat availability (someone else may have taken it)
    if (submission.seatId) {
      const conflict = await this.memberRepository.findActiveMemberBySeat(
        libraryId,
        submission.seatId,
        submission.slotId ?? undefined,
      );
      if (conflict) throw new HttpError(409, 'SEAT_ALREADY_ASSIGNED');
    }

    // 2. Find or create student account
    let student = await this.authRepository.findStudentByPhone(submission.mobileNo);
    if (!student) {
      // Create student without password — they use OTP / forgot-password to set it
      const tempPassword = await bcrypt.hash(
        `invite_${submission.mobileNo}_${Date.now()}`,
        10,
      );
      student = await this.authRepository.createStudent({
        name: submission.fullName,
        phone: submission.mobileNo,
        gender: submission.gender,
        password: tempPassword,
        isPhoneVerified: false,
        hasJoinedLibrary: true,
        role: 'STUDENT',
      });
    }

    // 3. Check if already a member of this library
    const existingMember = await this.memberRepository.findMemberByLibraryMobileOrAadhar(
      libraryId,
      submission.mobileNo,
    );
    if (existingMember) throw new HttpError(409, 'PHONE_ALREADY_MEMBER_OF_LIBRARY');

    // 4. Calculate duration from date range
    const start = new Date(submission.startDate);
    const end = new Date(submission.endDate);
    const diffMs = end.getTime() - start.getTime();
    const duration = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30)));

    // 5. Create member record
    const member = await this.memberRepository.createMember({
      fullName: submission.fullName,
      mobileNo: submission.mobileNo,
      aadharId: null,
      studentId: student.id,
      email: null,
      duration,
      libraryId,
      seatId: submission.seatId,
      slotId: submission.slotId,
      status: 'pending',
      planAmount: null,
      startDate: submission.startDate,
      endDate: submission.endDate,
      bookingId: null,
      paidAt: null,
      notes: null,
    });

    // 6. Mark submission approved
    const updated = await this.submissionRepository.update(submission.id, libraryId, {
      status: 'approved',
      studentId: student.id,
      memberId: member.id,
      reviewedAt: new Date(),
      reviewedBy: ownerId,
    });

    if (!updated) throw new InternalServerError('SUBMISSION_UPDATE_FAILED');
    return updated;
  }

  // ── Seat validation ──────────────────────────────────────────────────────
private async validateSeat(
  libraryId: string,
  seatId: string,
  gender: string,
  slotId?: string | null,
): Promise<void> {
  // 1. Check seat exists and is active
  const seat = await this.librarySeatRepository.findSeatByLibraryAndSeatId(libraryId, seatId);
  if (!seat) throw new HttpError(400, 'SEAT_NOT_FOUND');
  if (!seat.isActive) throw new HttpError(400, 'SEAT_NOT_ACTIVE');

  // 2. Gender check
  if (seat.gender !== 'any' && seat.gender !== gender) {
    throw new HttpError(400, 'SEAT_GENDER_MISMATCH');
  }

  // 3. Availability check using updated findActiveMemberBySeat
  // The method now internally handles fullday/twentyfour blocking logic
  const conflict = await this.memberRepository.findActiveMemberBySeat(
    libraryId,
    seatId,
    slotId ?? undefined,
  );
  if (conflict) throw new HttpError(409, 'SEAT_ALREADY_ASSIGNED');
}

  private async getOwnerLibraryOrThrow(ownerId: string) {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId.trim());
    if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');
    return library;
  }

  private resolvePlanAmount(
  slots: Array<{
    slotType: string;
    pricePerMonth: number;
    isActive: boolean;
    plans?: { duration: string; isActive: boolean; discountPercent: number }[];
  }>,
  slotId: string | null | undefined,
  duration: number,
): number | null {
  if (!slotId) return null;

  const slot = slots.find(s => s.slotType === slotId && s.isActive);
  if (!slot) return null;

  const baseAmount = slot.pricePerMonth * duration;

  if (slot.plans && slot.plans.length > 0) {
    const durationKey = `${duration}m`;
    const matchedPlan = slot.plans.find(
      p => p.duration === durationKey && p.isActive,
    );
    if (matchedPlan && matchedPlan.discountPercent > 0) {
      const discount = (baseAmount * matchedPlan.discountPercent) / 100;
      return Math.round(baseAmount - discount);
    }
  }

  return baseAmount;
}
}