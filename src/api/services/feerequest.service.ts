import { randomUUID } from 'crypto';
import { BadRequestError, HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { getDataSource } from '../../database/config/ormconfig.default';
import { MemberModel } from '../models/member.model';
import { LibraryRepository } from '../repositories/library.repository';
import { LibraryRecord } from '../repositories/types/library.repository.types';
import { FeeRequestRepository } from '../repositories/feerequest.repository';
import { FeeRequestRecord, CreateFeeRequestInput } from '../repositories/types/feerequest.repository.types';
import {
  SendFeeRequestByStudentPayload,
  SendBulkFeeRequestByStudentPayload,
  BulkFeeRequestResult,
  ListFeeRequestsPayload,
} from './types/feerequest.service.types';


@Service()
export class FeeRequestService {
  constructor(
    private readonly feeRequestRepository: FeeRequestRepository,
    private readonly libraryRepository: LibraryRepository,
  ) {}

  // ─── Send to single student ───────────────────────────────────────────────

  public async sendFeeRequestByStudent(
    ownerId: string,
    payload: SendFeeRequestByStudentPayload,
  ): Promise<FeeRequestRecord> {
    let library: LibraryRecord;
    try {
      library = await this.getOwnerLibraryOrThrow(ownerId);
    } catch (err) {
      console.error('[FeeRequestService] getOwnerLibraryOrThrow failed', { ownerId, err });
      throw err;
    }

    let member: MemberRecord;
    try {
      member = await this.getMemberByIdOrThrow(payload.memberId, library.id);
    } catch (err) {
      console.error('[FeeRequestService] getMemberByIdOrThrow failed', {
        memberId:  payload.memberId,
        libraryId: library.id,
        err,
      });
      throw err;
    }

    this.assertMemberEligible(member, payload.reason);

    const amount = payload.amount ?? member.planAmount ?? 0;
    if (amount <= 0) {
      console.warn('[FeeRequestService] FEE_REQUEST_AMOUNT_REQUIRED', {
        payloadAmount: payload.amount,
        planAmount:    member.planAmount,
        memberId:      member.id,
      });
      throw new BadRequestError('FEE_REQUEST_AMOUNT_REQUIRED');
    }

    const input: CreateFeeRequestInput = {
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
    };

    console.info('[FeeRequestService] creating fee request', input);

    try {
      return await this.feeRequestRepository.create(input);
    } catch (err) {
      console.error('[FeeRequestService] feeRequestRepository.create failed', {
        input,
        message: (err as Error)?.message,
        stack:   (err as Error)?.stack,
      });
      throw err; // let the controller wrap it as 500
    }
  }

  // ─── Send to multiple students ────────────────────────────────────────────

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
        console.warn('[FeeRequestService] FEE_REQUEST_AMOUNT_REQUIRED in bulk', {
          memberId:  member!.id,
          planAmount: member!.planAmount,
        });
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

    console.info('[FeeRequestService] bulk creating fee requests', {
      batchId,
      count: inputs.length,
      ownerId,
    });

    try {
      await this.feeRequestRepository.createMany(inputs);
    } catch (err) {
      console.error('[FeeRequestService] feeRequestRepository.createMany failed', {
        batchId,
        count:   inputs.length,
        message: (err as Error)?.message,
        stack:   (err as Error)?.stack,
      });
      throw err;
    }

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

  // ─── Save payment screenshot ──────────────────────────────────────────────

  public async savePaymentScreenshot(
    feeRequestId: string,
    studentId: string,
    screenshotUrl: string,
  ): Promise<FeeRequestRecord> {
    try {
      const record = await this.feeRequestRepository.findById(feeRequestId);
      if (!record) throw new NotFoundError('FEE_REQUEST_NOT_FOUND');

      const member = await this.getMemberByStudentId(studentId, record.libraryId);
      if (!member || member.id !== record.memberId) {
        throw new HttpError(403, 'FORBIDDEN');
      }

      return await this.feeRequestRepository.savePaymentScreenshot(
        feeRequestId,
        screenshotUrl,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('[FeeRequestService] savePaymentScreenshot failed', {
        feeRequestId,
        studentId,
        screenshotUrl,
        message: (error as Error)?.message,
        stack:   (error as Error)?.stack,
      });
      throw new InternalServerError('SAVE_SCREENSHOT_FAILED');
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async getOwnerLibraryOrThrow(ownerId: string): Promise<LibraryRecord> {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId.trim());
    if (!library) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }
    return library;
  }

  private async getMemberByIdOrThrow(
    memberId: string,
    libraryId: string,
  ): Promise<MemberRecord> {
    const { ObjectId } = await import('mongodb');

    let objectId: InstanceType<typeof ObjectId>;
    try {
      objectId = new ObjectId(memberId);
    } catch {
      // Invalid ObjectId format — treat as not found
      console.warn('[FeeRequestService] getMemberByIdOrThrow — invalid ObjectId', { memberId });
      throw new NotFoundError('MEMBER_NOT_FOUND');
    }

    const doc = await getDataSource()
      .getMongoRepository(MemberModel)
      .findOne({ where: { _id: objectId, libraryId } as any });

    if (!doc) throw new NotFoundError('MEMBER_NOT_FOUND');
    return this.mapMember(doc);
  }

  private async getMemberByStudentId(
    studentId: string,
    libraryId: string,
  ): Promise<MemberRecord | null> {
    const doc = await getDataSource()
      .getMongoRepository(MemberModel)
      .findOne({ where: { studentId, libraryId } as any });
    return doc ? this.mapMember(doc) : null;
  }

  /**
   * reason → required member.status:
   *   new_joinee           → pending
   *   subscription_expired → expired
   *   subscription_renewal → active
   *   manual               → any
   */
  private assertMemberEligible(member: MemberRecord, reason: string): void {
    if (reason === 'new_joinee' && member.status !== 'pending') {
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

// ─── Local type ───────────────────────────────────────────────────────────────
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