import { randomUUID } from 'crypto';
import { BadRequestError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { getDataSource } from '../../database/config/ormconfig.default';
import { MemberModel } from '../models/member.model';
import { LibraryRepository } from '../repositories/library.repository';
import { LibraryRecord } from '../repositories/types/library.repository.types';
import { FeeRequestRepository } from '../repositories/feerequest.repository';
import { FeeRequestRecord, CreateFeeRequestInput } from '../repositories/types/feerequest.repository.types';
import { SendFeeRequestByStudentPayload, SendBulkFeeRequestByStudentPayload, BulkFeeRequestResult, ListFeeRequestsPayload } from './types/feerequest.service.types';


@Service()
export class FeeRequestService {
  constructor(
    private readonly feeRequestRepository: FeeRequestRepository,
    private readonly libraryRepository: LibraryRepository,
  ) {}

  // ─── Send to single student ───────────────────────────────────────────────

  /**
   * Resolves member by studentId inside owner's library.
   * Throws 404 if no member record found.
   * To mark as paid — use existing PATCH /owner/members/:memberId/mark-paid
   */
  public async sendFeeRequestByStudent(
    ownerId: string,
    payload: SendFeeRequestByStudentPayload,
  ): Promise<FeeRequestRecord> {
    const library = await this.getOwnerLibraryOrThrow(ownerId);
    const member  = await this.getMemberByStudentIdOrThrow(payload.studentId, library.id);

    this.assertMemberEligible(member, payload.reason);

    const amount = payload.amount ?? member.planAmount ?? 0;
    if (amount <= 0) {
      throw new BadRequestError('FEE_REQUEST_AMOUNT_REQUIRED');
    }

    return this.feeRequestRepository.create({
      libraryId:    library.id,
      ownerId,
      memberId:     member.id,
      studentName:  member.fullName,
      studentPhone: member.mobileNo,
      bookingId:    member.bookingId ?? undefined,
      amount,
      reason:       payload.reason,
      note:         payload.note,
      dueDate:      payload.dueDate,
    });
  }

  // ─── Send to multiple students ────────────────────────────────────────────

  /**
   * All-or-nothing bulk send.
   * Phase 1 — resolve ALL members (fail-fast with all missing IDs listed).
   * Phase 2 — validate eligibility for every member.
   * Phase 3 — single createMany() — nothing written unless all pass.
   * To mark as paid — use existing PATCH /owner/members/:memberId/mark-paid
   */
  public async sendBulkFeeRequestsByStudent(
    ownerId: string,
    payload: SendBulkFeeRequestByStudentPayload,
  ): Promise<BulkFeeRequestResult> {
    if (!payload.studentIds.length) {
      throw new BadRequestError('STUDENT_IDS_REQUIRED');
    }

    const library   = await this.getOwnerLibraryOrThrow(ownerId);
    const uniqueIds = [...new Set(payload.studentIds)];

    // ── Phase 1: resolve all members ────────────────────────────────────────
    const resolvedResults = await Promise.all(
      uniqueIds.map(async studentId => {
        const member = await this.getMemberByStudentId(studentId, library.id);
        return { studentId, member };
      }),
    );

    const missing = resolvedResults.filter(r => !r.member).map(r => r.studentId);
    if (missing.length > 0) {
      throw new NotFoundError(`MEMBER_NOT_FOUND_FOR_STUDENT_IDS: ${missing.join(', ')}`);
    }

    // ── Phase 2: validate eligibility ────────────────────────────────────────
    for (const { studentId, member } of resolvedResults) {
      try {
        this.assertMemberEligible(member!, payload.reason);
      } catch (err: any) {
        throw new BadRequestError(`${err.message} (studentId: ${studentId})`);
      }
    }

    // ── Phase 3: bulk insert ─────────────────────────────────────────────────
    const batchId = randomUUID();

    const inputs: CreateFeeRequestInput[] = resolvedResults.map(({ member }) => {
      const amount = payload.amount ?? member!.planAmount ?? 0;
      if (amount <= 0) {
        throw new BadRequestError('FEE_REQUEST_AMOUNT_REQUIRED');
      }
      return {
        libraryId:    library.id,
        ownerId,
        memberId:     member!.id,
        studentName:  member!.fullName,
        studentPhone: member!.mobileNo,
        bookingId:    member!.bookingId ?? undefined,
        amount,
        reason:       payload.reason,
        note:         payload.note,
        dueDate:      payload.dueDate,
        batchId,
      };
    });

    await this.feeRequestRepository.createMany(inputs);

    return { batchId, sent: inputs.length };
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  public async getFeeRequestById(id: string): Promise<FeeRequestRecord> {
    const record = await this.feeRequestRepository.findById(id);
    if (!record) {
      throw new NotFoundError('FEE_REQUEST_NOT_FOUND');
    }
    return record;
  }

  public async listFeeRequests(
    ownerId: string,
    payload: ListFeeRequestsPayload,
  ): Promise<{ feeRequests: FeeRequestRecord[]; total: number }> {
    const library = await this.getOwnerLibraryOrThrow(ownerId);

    // If caller filters by studentId, resolve to memberId first
    let memberId = payload.memberId;
    if (payload.studentId && !memberId) {
      const member = await this.getMemberByStudentId(payload.studentId, library.id);
      memberId = member?.id;
    }

    return this.feeRequestRepository.list({
      libraryId: library.id,
      memberId,
      status:    payload.status,
      reason:    payload.reason,
      batchId:   payload.batchId,
      page:      payload.page  ?? 1,
      limit:     payload.limit ?? 20,
    });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  public async deleteFeeRequest(id: string): Promise<boolean> {
    const deleted = await this.feeRequestRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError('FEE_REQUEST_NOT_FOUND');
    }
    return true;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async getOwnerLibraryOrThrow(ownerId: string): Promise<LibraryRecord> {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId.trim());
    if (!library) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }
    return library;
  }

  /** Returns null when not found — used by bulk to collect all missing IDs first. */
  private async getMemberByStudentId(
    studentId: string,
    libraryId: string,
  ): Promise<MemberRecord | null> {
    const doc = await getDataSource()
      .getMongoRepository(MemberModel)
      .findOne({ where: { studentId, libraryId } as any });
    return doc ? this.mapMember(doc) : null;
  }

  /** Throws 404 immediately — used by single-student path. */
  private async getMemberByStudentIdOrThrow(
    studentId: string,
    libraryId: string,
  ): Promise<MemberRecord> {
    const member = await this.getMemberByStudentId(studentId, libraryId);
    if (!member) {
      throw new NotFoundError('MEMBER_NOT_FOUND_FOR_STUDENT');
    }
    return member;
  }

  /**
   * reason → required member.status:
   *   new_joinee           → pending
   *   subscription_expired → expired
   *   subscription_renewal → active
   *   manual               → any
   */
  private assertMemberEligible(member: MemberRecord, reason: string): void {
    if (reason === 'new_joinee'           && member.status !== 'pending') {
      throw new BadRequestError('MEMBER_NOT_IN_PENDING_STATUS');
    }
    if (reason === 'subscription_expired' && member.status !== 'expired') {
      throw new BadRequestError('MEMBER_SUBSCRIPTION_NOT_EXPIRED');
    }
    if (reason === 'subscription_renewal' && member.status !== 'active') {
      throw new BadRequestError('MEMBER_NOT_ACTIVE_FOR_RENEWAL');
    }
  }

  private mapMember(m: MemberModel): MemberRecord {
    return {
      id:          m.id.toHexString(),
      fullName:    m.fullName,
      mobileNo:    m.mobileNo,
      aadharId:    m.aadharId  ?? null,
      studentId:   m.studentId ?? null,
      email:       m.email,
      duration:    m.duration,
      libraryId:   m.libraryId,
      seatId:      m.seatId    ?? null,
      slotId:      m.slotId    ?? null,
      status:      m.status,
      planAmount:  m.planAmount ?? null,
      startDate:   m.startDate ?? null,
      endDate:     m.endDate   ?? null,
      bookingId:   m.bookingId ?? null,
      paidAt:      m.paidAt    ?? null,
      notes:       m.notes     ?? null,
      createdAt:   m.createdAt,
      updatedAt:   m.updatedAt,
    };
  }
}

// ─── Local type (mirrors MemberRecord from repository types) ─────────────────
type MemberRecord = {
  id: string;
  fullName: string;
  mobileNo: string;
  aadharId: string | null;
  studentId: string | null;
  email: string | null;
  duration: number;
  libraryId: string;
  seatId: string | null;
  slotId: string | null;
  status: 'active' | 'inactive' | 'expired' | 'pending';
  planAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  bookingId: string | null;
  paidAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};