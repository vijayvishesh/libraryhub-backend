import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { FeeRequestStatus, FeeRequestModel } from '../models/feerequest.model';
import { CreateFeeRequestInput, FeeRequestRecord, ListFeeRequestsQuery, ListFeeRequestsResult, UpdateFeeRequestStatusInput } from './types/feerequest.repository.types';

@Service()
export class FeeRequestRepository {
  // ─── Write ───────────────────────────────────────────────────────────────

  public async create(input: CreateFeeRequestInput): Promise<FeeRequestRecord> {
    const repo = this.getRepo();
    const now = new Date();
    const feeRequest = repo.create({
      ...input,
      currency: input.currency ?? 'INR',
      status: input.status ?? 'pending',
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repo.save(feeRequest);
    return this.map(saved);
  }

  /** Bulk insert – used when owner sends requests to multiple members at once */
  public async createMany(inputs: CreateFeeRequestInput[]): Promise<FeeRequestRecord[]> {
    const repo = this.getRepo();
    const now = new Date();
    const docs = inputs.map(input =>
      repo.create({
        ...input,
        currency: input.currency ?? 'INR',
        status: input.status ?? 'pending',
        createdAt: now,
        updatedAt: now,
      }),
    );
    const saved = await repo.save(docs);
    return saved.map(d => this.map(d));
  }

  // ─── Read ────────────────────────────────────────────────────────────────

  public async findById(id: string): Promise<FeeRequestRecord | null> {
    try {
      const doc = await this.getRepo().findOne({ where: { id: new ObjectId(id) } as any });
      return doc ? this.map(doc) : null;
    } catch {
      return null;
    }
  }

  public async list(query: ListFeeRequestsQuery): Promise<ListFeeRequestsResult> {
    const repo = this.getRepo();
    const where: Record<string, unknown> = {};

    if (query.libraryId) where['libraryId'] = query.libraryId;
    if (query.ownerId)   where['ownerId']   = query.ownerId;
    if (query.memberId)  where['memberId']  = query.memberId;
    if (query.status)    where['status']    = query.status;
    if (query.reason)    where['reason']    = query.reason;
    if (query.batchId)   where['batchId']   = query.batchId;

    const [docs, total] = await Promise.all([
      repo.find({
        where,
        order: { createdAt: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      repo.count({ where }),
    ]);

    return { feeRequests: docs.map(d => this.map(d)), total };
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  public async updateStatus(
    id: string,
    input: UpdateFeeRequestStatusInput,
  ): Promise<FeeRequestRecord | null> {
    try {
      const oid = new ObjectId(id);
      await this.getRepo().updateOne(
        { _id: oid },
        {
          $set: {
            status: input.status,
            ...(input.paidAt !== undefined && { paidAt: input.paidAt }),
            updatedAt: new Date(),
          },
        },
      );
      return this.findById(id);
    } catch {
      return null;
    }
  }

  /** Cancel all pending requests for a member (e.g. when member is removed) */
  public async cancelPendingByMember(memberId: string, libraryId: string): Promise<void> {
    await this.getRepo().updateMany(
      { memberId, libraryId, status: 'pending' },
      { $set: { status: 'cancelled' as FeeRequestStatus, updatedAt: new Date() } },
    );
  }

  public async delete(id: string): Promise<boolean> {
    try {
      const result = await this.getRepo().deleteOne({ _id: new ObjectId(id) });
      return (result.deletedCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private map(doc: FeeRequestModel): FeeRequestRecord {
    return {
      id:           doc.id.toHexString(),
      libraryId:    doc.libraryId,
      ownerId:      doc.ownerId,
      memberId:     doc.memberId,
      studentName:  doc.studentName,
      studentPhone: doc.studentPhone,
      bookingId:    doc.bookingId,
      amount:       doc.amount,
      currency:     doc.currency,
      reason:       doc.reason,
      status:       doc.status,
      note:         doc.note,
      dueDate:      doc.dueDate,
      paidAt:       doc.paidAt,
      batchId:      doc.batchId,
      createdAt:    doc.createdAt,
      updatedAt:    doc.updatedAt,
    };
  }

  private getRepo(): MongoRepository<FeeRequestModel> {
    return getDataSource().getMongoRepository(FeeRequestModel);
  }
}