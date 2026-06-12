/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-lines */
import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';
import { LibraryPaymentMethod } from '../constants/library.constants';
import {
  AddMemberRequest,
  ListInactiveMembersQueryRequest,
  ListMemberPaymentsQueryRequest,
  ListMembersQueryRequest,
  ListMemberUploadsQueryRequest,
  SubmitMemberViaInviteLinkRequest,
  UpdateMemberRequest,
} from '../controllers/requests/member.request';
import {
  buildMemberUploadReport,
  buildMemberUploadTemplate,
  buildValidatedUploadPayload,
  getMemberUploadErrorMessage,
  MemberUploadFile,
  parseMemberUploadFile,
  resolveMemberBulkUploadStatus,
} from '../helpers/memberUpload.helper';
import { AuthRepository } from '../repositories/auth.repositories';
import { BookingRepository } from '../repositories/booking.repository';
import { LibraryRepository } from '../repositories/library.repository';
import { LibrarySeatRepository } from '../repositories/librarySeat.repository';
import { MemberRepository } from '../repositories/member.repository';
import { MemberBulkUploadRepository } from '../repositories/memberBulkUpload.repository';
import { MemberInviteLinkRepository } from '../repositories/memberInviteLink.repository';
import { MemberInviteSubmissionRepository } from '../repositories/memberInviteSubmission.repository';
import { MemberPaymentRepository } from '../repositories/memberPayment.repository';
import { MemberMsgResponse, MemberRecord } from '../repositories/types/member.repository.types';
import { MemberBulkUploadRecord } from '../repositories/types/memberBulkUpload.repository.types';
import { MemberInviteLinkRecord } from '../repositories/types/memberInviteLink.repository.types';
import { SubmissionRecord } from '../repositories/types/memberInviteSubmission.repository.types';
import { ListMemberPaymentsResult } from '../repositories/types/memberPayment.repository.types';
import { sendStudentBookingStatusPush } from '../../loaders/cronLoader';
import { StudentRecord } from '../repositories/types/auth.repository.types';

export type ListMembersResult = {
  members: MemberWithFlags[];
  page: number;
  limit: number;
  total: number;
};

export type InviteFlags = {
  isInviteSubmission: boolean;
  isNewUser: boolean;
  isExistingMember: boolean;
  hasPendingFee: boolean;
  pendingFeeAmount: number | null;
  previousEndDate: string | null;
  isDuplicate: boolean;
  avatarUrl: string | null;
};

export type MemberWithFlags = MemberRecord & InviteFlags;

export type ListMemberUploadsResult = {
  uploads: MemberBulkUploadRecord[];
  page: number;
  limit: number;
  total: number;
};

@Service()
export class MemberService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly memberRepository: MemberRepository,
    private readonly bookingRepository: BookingRepository,
    private readonly memberBulkUploadRepository: MemberBulkUploadRepository,
    private readonly memberInviteLinkRepository: MemberInviteLinkRepository,
    private readonly librarySeatRepository: LibrarySeatRepository,
    private readonly memberPaymentRepository: MemberPaymentRepository,
    private readonly memberInviteSubmissionRepository: MemberInviteSubmissionRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  public async addMember(ownerId: string, payload: AddMemberRequest): Promise<MemberMsgResponse> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const member = await this.createMemberForLibrary(library.id, payload);
      return { msg: 'Member added successfully', studentId: member?.studentId ?? null };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('MEMBER_CREATION_FAILED');
    }
  }

  public async listMembers(
    ownerId: string,
    query: ListMembersQueryRequest,
  ): Promise<ListMembersResult> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const page = query.page ?? 1;
      const limit = query.limit ?? 100;

      const result = await this.memberRepository.listMembersByLibrary({
        libraryId: library.id,
        page,
        limit,
        search: query.search?.trim() || undefined,
        status: query.status as 'active' | 'inactive' | 'expired' | 'pending' | undefined,
        slotId: query.slotId?.trim() || undefined,
      });

      const memberIds = result.members.map(m => m.id);
      const submissionMap = await this.memberInviteSubmissionRepository.findByMemberIds(memberIds);

      const studentIds = result.members.map(m => m.studentId).filter(Boolean) as string[];
      const students = await this.authRepository.findStudentsByIds(studentIds);
      const studentMap = new Map(students.map(s => [s.id, s]));

      return {
        members: result.members.map(m => this.mergeInviteFlags(m, submissionMap,studentMap)),
        page,
        limit,
        total: result.total,
        
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('LIST_MEMBERS_FAILED');
    }
  }

  public async getMemberById(ownerId: string, memberId: string): Promise<MemberWithFlags> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const member = await this.memberRepository.findMemberByIdAndLibrary(
        memberId.trim(),
        library.id,
      );
      if (!member) {
        throw new NotFoundError('MEMBER_NOT_FOUND');
      }

      const submissionMap = await this.memberInviteSubmissionRepository.findByMemberIds([
        member.id,
      ]);
       const student = member.studentId 
      ? await this.authRepository.findStudentById(member.studentId) 
      : null;
    const studentMap = new Map(student ? [[student.id, student]] : []);
      return this.mergeInviteFlags(member, submissionMap, studentMap);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('GET_MEMBER_FAILED');
    }
  }

  /* eslint-disable max-lines-per-function */
  public async updateMember(
    ownerId: string,
    memberId: string,
    payload: UpdateMemberRequest,
  ): Promise<MemberRecord> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const existingMember = await this.memberRepository.findMemberByIdAndLibrary(
        memberId.trim(),
        library.id,
      );
      if (!existingMember) {
        throw new NotFoundError('MEMBER_NOT_FOUND');
      }

      const mobileNo = payload.mobileNo?.trim();
      const aadharId = payload.aadharId?.trim();
      if (mobileNo || aadharId) {
        const duplicateMember = await this.memberRepository.findMemberByLibraryMobileOrAadhar(
          library.id,
          mobileNo,
          aadharId,
          existingMember.id,
        );
        if (duplicateMember) {
          throw new HttpError(409, 'MEMBER_ALREADY_EXISTS');
        }
      }

      const newSeatId =
        payload.seatId === undefined ? existingMember.seatId : payload.seatId?.trim() || null;
      const newSlotId =
        payload.slotId === undefined ? existingMember.slotId : payload.slotId?.trim() || null;

      if (
        newSeatId &&
        (newSeatId !== existingMember.seatId || newSlotId !== existingMember.slotId)
      ) {
        const seatConflict = await this.memberRepository.findActiveMemberBySeat(
          library.id,
          newSeatId,
          newSlotId || undefined,
          existingMember.id,
        );
        if (seatConflict) {
          throw new HttpError(409, 'SEAT_ALREADY_ASSIGNED');
        }
      }

      const nextDuration = payload.duration ?? existingMember.duration;
      const nextStartDate = payload.startDate ?? existingMember.startDate;
      if (payload.startDate) {
        this.assertValidIsoDate(payload.startDate);
      }
      if (payload.endDate) {
        this.assertValidIsoDate(payload.endDate);
      }

      const resolvedEndDate =
        payload.endDate ??
        (payload.duration !== undefined || payload.startDate !== undefined
          ? this.addMonthsIsoDate(
              nextStartDate || new Date().toISOString().slice(0, 10),
              nextDuration,
            )
          : existingMember.endDate);

      const updatedMember = await this.memberRepository.updateMemberByIdAndLibrary(
        existingMember.id,
        library.id,
        {
          fullName: payload.fullName?.trim(),
          mobileNo,
          aadharId,
          email: payload.email === undefined ? undefined : payload.email?.trim() || null,
          duration: payload.duration,
          seatId: payload.seatId === undefined ? undefined : payload.seatId.trim() || null,
          slotId: payload.slotId === undefined ? undefined : payload.slotId.trim() || null,
          status: payload.status,
          planAmount: payload.planAmount === undefined ? undefined : Number(payload.planAmount),
          startDate: payload.startDate,
          endDate: resolvedEndDate,
          notes: payload.notes === undefined ? undefined : payload.notes.trim() || null,
          updatedAt: new Date(),
           reason: payload.reason === undefined ? undefined : payload.reason?.trim() || null,
        },
      );

      if (!updatedMember) {
        throw new NotFoundError('MEMBER_NOT_FOUND');
      }

      // Sync updated fields to the booking record
      if (existingMember.bookingId) {
        const bookingUpdates: Record<string, unknown> = {};

        // Sync seatId if changed
        if (payload.seatId !== undefined && newSeatId !== existingMember.seatId && newSeatId) {
          bookingUpdates.seatId = newSeatId;
        }

        // Sync slot fields if changed
        if (payload.slotId !== undefined && newSlotId !== existingMember.slotId && newSlotId) {
          bookingUpdates.slotType = newSlotId;
          // Fetch library to resolve slot name and times
          const memberLibrary = await this.libraryRepository.findLibraryById(
            existingMember.libraryId,
          );
          const slotInfo = memberLibrary?.slots?.find(s => s.slotType === newSlotId);
          if (slotInfo) {
            bookingUpdates.slotName = slotInfo.name;
            bookingUpdates.slotStartTime = slotInfo.startTime;
            bookingUpdates.slotEndTime = slotInfo.endTime;
          }
        }

        // Sync amount if planAmount changed
        if (payload.planAmount !== undefined) {
          bookingUpdates.amount = Number(payload.planAmount);
        }

        // Sync duration if changed
        if (payload.duration !== undefined) {
          bookingUpdates.duration = payload.duration;
        }

        // Sync startDate if changed
        if (payload.startDate !== undefined) {
          bookingUpdates.startDate = payload.startDate;
        }

        // Sync validUntil when endDate, duration, or startDate changes
        if (
          resolvedEndDate &&
          (payload.endDate !== undefined ||
            payload.duration !== undefined ||
            payload.startDate !== undefined)
        ) {
          bookingUpdates.validUntil = resolvedEndDate;
        }

        if (Object.keys(bookingUpdates).length > 0) {
          await this.bookingRepository.updateBookingFields(
            existingMember.bookingId,
            bookingUpdates,
          );
        }
      }

      return updatedMember;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('UPDATE_MEMBER_FAILED');
    }
  }

  public async deleteMember(ownerId: string, memberId: string): Promise<MemberMsgResponse> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const deleted = await this.memberRepository.deleteMemberByIdAndLibrary(
        memberId.trim(),
        library.id,
      );
      if (!deleted) {
        throw new NotFoundError('MEMBER_NOT_FOUND');
      }

      return { msg: 'Member removed successfully' };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('DELETE_MEMBER_FAILED');
    }
  }

 public async markMemberPaid(
  ownerId:          string,
  memberId:         string,
  paymentMethod?:   string,
  overrideDuration?: number,
  overrideAmount?:  number,
): Promise<MemberRecord> {
  try {
    const library = await this.getOwnerLibraryOrThrow(ownerId);
    const member  = await this.memberRepository.findMemberByIdAndLibrary(
      memberId.trim(),
      library.id,
    );
    if (!member) {
      throw new NotFoundError('MEMBER_NOT_FOUND');
    }

    if (
      member.status !== 'pending' &&
      member.status !== 'active'  &&
      member.status !== 'expired'
    ) {
      throw new HttpError(409, 'MEMBER_NOT_ELIGIBLE_FOR_PAYMENT');
    }

    const isFirstPayment = member.status === 'pending';
    const isRenewal      = member.status === 'active' || member.status === 'expired';
    const duration       = overrideDuration || (isFirstPayment ? member.duration || 1 : 1);

    const newStartDate =
      isRenewal && member.endDate
        ? member.endDate
        : new Date().toISOString().slice(0, 10);

    const newEndDate = this.calculateEndDate(newStartDate, duration);

    const monthlyRate =
      member.duration && member.duration > 0
        ? (member.planAmount ?? 0) / member.duration
        : (member.planAmount ?? 0);
    const newAmount = overrideAmount ?? monthlyRate * duration;

    // ✅ KEY FIX: check if endDate is already in past after payment
    // If owner is marking paid for a back-dated member (old data entry),
    // endDate may already be expired — set status accordingly
    const today      = new Date().toISOString().slice(0, 10);
    const resolvedStatus: 'active' | 'expired' =
      newEndDate < today ? 'expired' : 'active';

    const updated = await this.memberRepository.updateMemberByIdAndLibrary(
      member.id,
      library.id,
      {
        status:    resolvedStatus, // ← 'expired' if endDate already passed
        paidAt:    new Date(),
        startDate: newStartDate,
        endDate:   newEndDate,
        duration,
        planAmount: newAmount,
        paymentStatus:  'paid', 
        updatedAt:  new Date(),
      },
    );

    if (!updated) {
      throw new InternalServerError('MARK_MEMBER_PAID_FAILED');
    }

    try {
      await this.memberPaymentRepository.createPayment({
        memberId: member.id,
        libraryId: library.id,
        studentId: member.studentId ?? null,
        bookingId: member.bookingId ?? null,
        amount: newAmount,
        duration,
        startDate: newStartDate,
        endDate: newEndDate,
        paymentMethod: paymentMethod ?? member.paymentMethod ?? null,
        paymentScreenshotUrl: member.paymentScreenshotUrl ?? null,
        type: isFirstPayment ? 'first_join' : 'renewal',
        status: 'confirmed',
        paidAt: new Date(),
      });
    } catch {
      // non-critical — payment record failure shouldn't block main flow
    }

    if (member.bookingId) {
      await this.bookingRepository.markBookingPaid(
        member.bookingId,
        paymentMethod as LibraryPaymentMethod | undefined,
      );
    await this.bookingRepository.updateBookingFields(member.bookingId, {
    paymentStatus: 'paid',
    updatedAt: new Date(),
  });
    }

    // ✅ Only send push if member is actually active (not back-dated expired)
    if (member.studentId && member.bookingId && resolvedStatus === 'active') {
      try {
        await sendStudentBookingStatusPush(
          member.studentId,
          'approved',
          library.name,
          member.bookingId,
        );
      } catch {
        // non-critical
      }
    }

    return updated;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new InternalServerError('MARK_MEMBER_PAID_FAILED');
  }
}

  private calculateEndDate(startDateIso: string, durationMonths: number): string {
    const date = new Date(`${startDateIso}T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() + durationMonths);
    return date.toISOString().slice(0, 10);
  }

  public async downloadMemberTemplate(): Promise<{ filename: string; buffer: Buffer }> {
    const buffer = await buildMemberUploadTemplate();
    return { filename: 'members-upload-template.xlsx', buffer };
  }

  public async uploadMembersExcel(
    ownerId: string,
    file: MemberUploadFile,
  ): Promise<MemberBulkUploadRecord> {
    try {
      if (!file?.buffer?.length) {
        throw new HttpError(400, 'UPLOAD_FILE_REQUIRED');
      }

      const isCSV = file.originalname.toLowerCase().endsWith('.csv');
      const isXLSX = file.originalname.toLowerCase().endsWith('.xlsx');

      if (!isCSV && !isXLSX) {
        throw new HttpError(400, 'UPLOAD_FILE_MUST_BE_CSV_OR_XLSX');
      }

      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const parsedRows = await parseMemberUploadFile(file);
      const results = [];
      let successCount = 0;

      for (const row of parsedRows) {
        try {
          const payload = await buildValidatedUploadPayload(row);
          const member = await this.createMemberForLibrary(library.id, payload);
          successCount += 1;
          results.push({
            rowNumber: row.rowNumber,
            fullName: row.fullName,
            mobileNo: row.mobileNo,
            aadharId: row.aadharId,
            email: row.email,
            duration: row.duration,
            seatId: row.seatId,
            slotId: row.slotId,
            statusValue: row.status,
            planAmount: row.planAmount,
            startDate: row.startDate,
            endDate: row.endDate,
            notes: row.notes,
            uploadStatus: 'success' as const,
            errorMessage: null,
            memberId: member.id,
          });
        } catch (error) {
          results.push({
            rowNumber: row.rowNumber,
            fullName: row.fullName,
            mobileNo: row.mobileNo,
            aadharId: row.aadharId,
            email: row.email,
            duration: row.duration,
            seatId: row.seatId,
            slotId: row.slotId,
            statusValue: row.status,
            planAmount: row.planAmount,
            startDate: row.startDate,
            endDate: row.endDate,
            notes: row.notes,
            uploadStatus: 'failed' as const,
            errorMessage: getMemberUploadErrorMessage(error),
            memberId: null,
          });
        }
      }

      const failedCount = results.length - successCount;
      const status = resolveMemberBulkUploadStatus(successCount, failedCount);

      return await this.memberBulkUploadRepository.createUpload({
        ownerId,
        libraryId: library.id,
        fileName: file.originalname,
        status,
        totalRows: results.length,
        successCount,
        failedCount,
        rows: results,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('MEMBER_BULK_UPLOAD_FAILED');
    }
  }

  public async listMemberUploads(
    ownerId: string,
    query: ListMemberUploadsQueryRequest,
  ): Promise<ListMemberUploadsResult> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const page = query.page ?? 1;
      const limit = query.limit ?? 100;
      const result = await this.memberBulkUploadRepository.listUploadsByLibrary({
        libraryId: library.id,
        page,
        limit,
        status: query.status,
      });

      return { uploads: result.uploads, page, limit, total: result.total };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('LIST_MEMBER_UPLOADS_FAILED');
    }
  }

  public async downloadMemberUploadReport(
    ownerId: string,
    uploadId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const upload = await this.memberBulkUploadRepository.findUploadByIdAndLibrary(
        uploadId.trim(),
        library.id,
      );
      if (!upload) {
        throw new NotFoundError('MEMBER_UPLOAD_NOT_FOUND');
      }

      const buffer = await buildMemberUploadReport(upload.rows);
      return { filename: `members-upload-report-${upload.id}.xlsx`, buffer };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('DOWNLOAD_MEMBER_UPLOAD_REPORT_FAILED');
    }
  }

  public async generateMemberInviteLink(
    ownerId: string,
    siteLibraryId: string,
  ): Promise<MemberInviteLinkRecord> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const token = uuidv4();
      return await this.memberInviteLinkRepository.createInviteLink({
        ownerId,
        libraryId: library.id,
        siteLibraryId,
        token,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('GENERATE_MEMBER_INVITE_LINK_FAILED');
    }
  }

  public async getInviteLinkDetails(token: string): Promise<MemberInviteLinkRecord | null> {
    try {
      return await this.memberInviteLinkRepository.findValidLinkByToken(token);
    } catch (error) {
      console.warn('[MemberService] Error fetching invite link details:', error);
      throw new InternalServerError('GET_INVITE_LINK_DETAILS_FAILED');
    }
  }

  public async getInviteLinkFormData(token: string): Promise<{
    inviteLink: MemberInviteLinkRecord;
    libraryName: string;
    libraryAddress: string;
    slots: {
      slotType: string;
      name: string;
      startTime: string;
      endTime: string;
      isActive: boolean;
    }[];
    seats: { seatId: string; label: string; gender: string; isActive: boolean }[];
  } | null> {
    try {
      const inviteLink = await this.memberInviteLinkRepository.findValidLinkByToken(token);
      if (!inviteLink) {
        return null;
      }

      const [library, seats] = await Promise.all([
        this.libraryRepository.findLibraryById(inviteLink.libraryId),
        this.librarySeatRepository.findAllSeatsByLibraryId(inviteLink.libraryId),
      ]);

      const slots = (library?.slots ?? []).map(s => ({
        slotType: s.slotType,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        isActive: s.isActive,
      }));

      return {
        inviteLink,
        libraryName: library?.name ?? '',
        libraryAddress: library
          ? `${library.address ?? ''}, ${library.city ?? ''}`.replace(/^,\s*/, '').trim()
          : '',
        slots,
        seats: seats.map(s => ({
          seatId: s.seatId,
          label: s.label,
          gender: s.gender,
          isActive: s.isActive,
        })),
      };
    } catch (error) {
      console.warn('[MemberService] Error fetching invite link form data:', error);
      throw new InternalServerError('GET_INVITE_LINK_DETAILS_FAILED');
    }
  }

  public async getRenewalReminders(
    ownerId: string,
    tab: 'today' | '3Days' | '7Days' | 'month',
  ): Promise<{
    members: MemberRecord[];
    tabCounts: { today: number; '3Days': number; '7Days': number; month: number };
    totalAtRisk: number;
  }> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const today = new Date().toISOString().slice(0, 10);
      const d3 = new Date();
      d3.setDate(d3.getDate() + 3);
      const d7 = new Date();
      d7.setDate(d7.getDate() + 7);
      const d30 = new Date();
      d30.setDate(d30.getDate() + 30);
      const date3 = d3.toISOString().slice(0, 10);
      const date7 = d7.toISOString().slice(0, 10);
      const date30 = d30.toISOString().slice(0, 10);

      const ranges: Record<string, { from: string; to: string }> = {
        today: { from: '1970-01-01', to: today },
        '3Days': { from: today, to: date3 },
        '7Days': { from: today, to: date7 },
        month: { from: today, to: date30 },
      };

      const [todayMembers, d3Members, d7Members, d30Members] = await Promise.all([
        this.memberRepository.findMembersExpiringInRange(
          library.id,
          ranges.today.from,
          ranges.today.to,
        ),
        this.memberRepository.findMembersExpiringInRange(
          library.id,
          ranges['3Days'].from,
          ranges['3Days'].to,
        ),
        this.memberRepository.findMembersExpiringInRange(
          library.id,
          ranges['7Days'].from,
          ranges['7Days'].to,
        ),
        this.memberRepository.findMembersExpiringInRange(
          library.id,
          ranges.month.from,
          ranges.month.to,
        ),
      ]);

      const tabMap = {
        today: todayMembers,
        '3Days': d3Members,
        '7Days': d7Members,
        month: d30Members,
      };
      const members = tabMap[tab];
      const totalAtRisk = d30Members.reduce((sum, m) => sum + (m.planAmount ?? 0), 0);

      return {
        members,
        tabCounts: {
          today: todayMembers.length,
          '3Days': d3Members.length,
          '7Days': d7Members.length,
          month: d30Members.length,
        },
        totalAtRisk,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('GET_RENEWAL_REMINDERS_FAILED');
    }
  }

  public async submitMemberViaInviteLink(
    token: string,
    payload: SubmitMemberViaInviteLinkRequest,
  ): Promise<MemberRecord> {
    try {
      const inviteLink = await this.memberInviteLinkRepository.findValidLinkByToken(token);
      if (!inviteLink) {
        throw new HttpError(404, 'INVITE_LINK_INVALID_OR_EXPIRED');
      }

      const member = await this.createMemberForLibrary(inviteLink.libraryId, payload);
      await this.memberInviteLinkRepository.markLinkAsUsed(token, member.id);
      return member;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('SUBMIT_MEMBER_VIA_INVITE_LINK_FAILED');
    }
  }

  public async getMemberPaymentHistory(
    ownerId: string,
    memberId: string,
    query: ListMemberPaymentsQueryRequest,
  ): Promise<ListMemberPaymentsResult> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const member = await this.memberRepository.findMemberByIdAndLibrary(
        memberId.trim(),
        library.id,
      );
      if (!member) {
        throw new NotFoundError('MEMBER_NOT_FOUND');
      }

      const page = query.page ?? 1;
      const limit = query.limit ?? 100;
      const result = await this.memberPaymentRepository.listPaymentsByMember({
        memberId: member.id,
        libraryId: library.id,
        page,
        limit,
      });

      return { payments: result.payments, total: result.total, page:  result.page,limit:result.limit, };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('GET_MEMBER_PAYMENT_HISTORY_FAILED');
    }
  }
  /* eslint-disable max-lines-per-function */
 private async createMemberForLibrary(
    libraryId: string,
    payload: AddMemberRequest | SubmitMemberViaInviteLinkRequest,
  ): Promise<MemberRecord> {
    const fullName = payload.fullName.trim();
    const mobileNo = payload.mobileNo.trim();
    const aadharId = payload.aadharId?.trim() ?? null;
    const email = payload.email?.trim() ?? null;
    const seatId = payload.seatId?.trim() ?? null;
    const slotId = payload.slotId?.trim() ?? null;
    const markPaid = 'markPaid' in payload && payload.markPaid === true;
    const startDate = payload.startDate || new Date().toISOString().slice(0, 10);
    this.assertValidIsoDate(startDate);
    const endDate = this.addMonthsIsoDate(startDate, payload.duration);
    const notes = payload.notes?.trim() ?? null;
    const planAmount = typeof payload.planAmount === 'number' ? payload.planAmount : null;

    // ✅ Back-date check: if markPaid but endDate already passed, mark as expired
    const today = new Date().toISOString().slice(0, 10);
    const status: 'active' | 'pending' | 'expired' = markPaid
      ? endDate < today
        ? 'expired'
        : 'active'
      : 'pending';

    // Check if phone belongs to the library owner
    const ownerLibrary = await this.libraryRepository.findLibraryById(libraryId);
    if (ownerLibrary) {
      const owner = await this.authRepository.findOwnerById(ownerLibrary.ownerId);
      if (owner && owner.phone === mobileNo) {
        throw new HttpError(409, 'OWNER_CANNOT_BE_ADDED_AS_MEMBER');
      }
    }

    // Check member already exists in this library
    const existingMember = await this.memberRepository.findMemberByLibraryMobileOrAadhar(
      libraryId,
      mobileNo,
      aadharId || undefined,
    );
    if (existingMember) {
      throw new HttpError(409, 'MEMBER_ALREADY_EXISTS');
    }

    // Validate seat if provided
    if (seatId) {
      const validSeat = await this.librarySeatRepository.findSeatByLibraryAndSeatId(
        libraryId,
        seatId,
      );
      if (!validSeat) {
        throw new HttpError(400, 'SEAT_NOT_FOUND');
      }

      const seatConflict = await this.memberRepository.findActiveMemberBySeat(
        libraryId,
        seatId,
        slotId || undefined,
      );
      if (seatConflict) {
        throw new HttpError(409, 'SEAT_ALREADY_ASSIGNED');
      }
    }

    // Find or create student account by phone number
    let student = await this.authRepository.findStudentByPhone(mobileNo);
    const isNewUser = !student;

    if (!student) {
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(`owner_added_${mobileNo}_${Date.now()}`, 10);
      student = await this.authRepository.createStudent({
        name: fullName,
        phone: mobileNo,
        gender: ('gender' in payload && payload.gender) ? payload.gender : 'other',
        password: hashedPassword,
        isPhoneVerified: false,
        hasJoinedLibrary: true,
        role: 'STUDENT',
      });
    } else {
      await this.authRepository.updateStudentHasJoinedLibrary(student.id, true);
    }

    // Fetch library details needed for booking record
    const library = await this.libraryRepository.findLibraryById(libraryId);
    if (!library) {
      throw new HttpError(404, 'LIBRARY_NOT_FOUND');
    }

    // Find slot info for booking record
    const slotInfo = slotId ? (library.slots ?? []).find(s => s.slotType === slotId) : null;

    // Create booking record so student can see their library after login
    const bookingStatus = markPaid ? 'confirmed' : 'pending_payment';
    let bookingId: string | null = null;

    try {
      if (seatId && slotId) {
        const booking = await this.bookingRepository.createBooking({
          libraryId,
          studentId: student.id,
          libraryName: library.name ?? '',
          libraryAddress: [library.address, library.city].filter(Boolean).join(', '),
          slotType: slotId as any,
          slotName: slotInfo?.name ?? slotId,
          slotStartTime: slotInfo?.startTime ?? '06:00',
          slotEndTime: slotInfo?.endTime ?? '22:00',
          seatId,
          sectionId: null,
          paymentMethod: ('paymentMethod' in payload && payload.paymentMethod
            ? payload.paymentMethod
            : 'cash') as any,
          amount: planAmount ?? 0,
          duration: payload.duration,
          startDate,
          validUntil: endDate,
          status: bookingStatus,
          checkedInAt: null,
          checkedOutAt: null,
          invoiceNo: `INV-OWNER-${Date.now()}`,
        });
        bookingId = booking.id;
      }
    } catch (bookingError) {
      console.warn('[MemberService] Failed to create booking for owner-added member:', {
        error: bookingError instanceof Error ? bookingError.message : bookingError,
        seatId,
        slotId,
        studentId: student.id,
        libraryId,
      });
    }

    // Create member record with studentId and bookingId linked
    const member = await this.memberRepository.createMember({
      fullName,
      mobileNo,
      aadharId,
      studentId: student.id,
      email,
      duration: payload.duration,
      libraryId,
      seatId,
      slotId,
      status,
      planAmount,
      startDate,
      endDate,
      bookingId,
      paidAt: status === 'active' ? new Date() : null,
      notes,
      isNewUser,
      isInviteSubmission: false,
       reason: payload.reason ?? null, 
    });

    if (!member) {
      throw new InternalServerError('MEMBER_CREATION_FAILED');
    }

    return member;
  }

  private async getOwnerLibraryOrThrow(ownerId: string) {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId.trim());
    if (!library) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }
    return library;
  }

  private assertValidIsoDate(isoDate: string): void {
    const parsedDate = new Date(`${isoDate}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new HttpError(400, 'INVALID_DATE');
    }
    if (parsedDate.toISOString().slice(0, 10) !== isoDate) {
      throw new HttpError(400, 'INVALID_DATE');
    }
  }

  private addMonthsIsoDate(isoDate: string, monthsToAdd: number): string {
    this.assertValidIsoDate(isoDate);
    const date = new Date(`${isoDate}T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() + monthsToAdd);
    return date.toISOString().slice(0, 10);
  }

  private mergeInviteFlags(
    member: MemberRecord,
    submissionMap: Map<string, SubmissionRecord>,
    studentMap?: Map<string, StudentRecord>,
  ): MemberWithFlags {
    const submission = member.id ? submissionMap.get(member.id) : undefined;
    return {
      ...member,
      isInviteSubmission: submission?.isInviteSubmission ?? false,
      isNewUser: submission?.isNewUser ?? member.isNewUser ?? false,
      isExistingMember: submission?.isExistingMember ?? false,
      hasPendingFee: submission?.hasPendingFee ?? false,
      pendingFeeAmount: submission?.pendingFeeAmount ?? null,
      previousEndDate: submission?.previousEndDate ?? null,
      isDuplicate: submission?.isDuplicate ?? false,
       avatarUrl: studentMap?.get(member.studentId ?? '')?.avatarUrl ?? null,
    };
  }

//   public async updateStudentAvatar(
//   studentId: string,
//   avatarUrl: string,
// ): Promise<void> {
//   await this.authRepository.updateStudent(studentId, { avatarUrl });
// }

public async deactivateMember(
  ownerId: string,
  memberId: string,
): Promise<MemberRecord> {
  try {
    const library = await this.getOwnerLibraryOrThrow(ownerId);
    const member = await this.memberRepository.findMemberByIdAndLibrary(
      memberId.trim(),
      library.id,
    );

    if (!member) {
      throw new NotFoundError('MEMBER_NOT_FOUND');
    }

    if (member.status === 'inactive') {
      throw new HttpError(409, 'MEMBER_ALREADY_INACTIVE');
    }

    const updated = await this.memberRepository.updateMemberByIdAndLibrary(
      member.id,
      library.id,
      {
        status: 'inactive',
        updatedAt: new Date(),
      },
    );

    if (!updated) {
      throw new InternalServerError('DEACTIVATE_MEMBER_FAILED');
    }

    return updated;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new InternalServerError('DEACTIVATE_MEMBER_FAILED');
  }
}

public async listInactiveMembers(
  ownerId: string,
  query: ListInactiveMembersQueryRequest,
): Promise<{
  members: (MemberRecord & { memberType: 'expired' | 'overdue' | 'inactive' })[];
  page: number;
  limit: number;
  total: number;
  expiredCount: number;
  overdueCount: number;
  inactiveCount: number;
}> {
  try {
    const library = await this.getOwnerLibraryOrThrow(ownerId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const todayIso = new Date().toISOString().slice(0, 10);

    const result = await this.memberRepository.listInactiveMembers({
      libraryId: library.id,
      type: query.type,
      search: query.search?.trim() || undefined,
      page,
      limit,
      todayIso,
    });

    return {
      members: result.members,
      page,
      limit,
      total: result.total,
      expiredCount: result.expiredCount,
      overdueCount: result.overdueCount,
      inactiveCount: result.inactiveCount,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError('LIST_INACTIVE_MEMBERS_FAILED');
  }
}
}
