import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { MemberLeaveRequestModel } from '../models/memberLeaveRequest.model';
import {
  CreateLeaveRequestInput,
  ListLeaveRequestsQuery,
  ListLeaveRequestsResult,
  MemberLeaveRequestRecord,
  UpdateLeaveRequestInput,
} from './types/memberLeaveRequest.repository.types';

@Service()
export class MemberLeaveRequestRepository {

  public async createLeaveRequest(
    input: CreateLeaveRequestInput,
  ): Promise<MemberLeaveRequestRecord> {
    const repo = this.getRepo();
    const now = new Date();
    const doc = repo.create({
      memberId:        input.memberId,
      studentId:       input.studentId,
      libraryId:       input.libraryId,
      bookingId:       input.bookingId ?? null,
      reason:          input.reason ?? null,
      status:          'pending',
      rejectionReason: null,
      resolvedAt:      null,
      createdAt:       now,
      updatedAt:       now,
    });
    const saved = await repo.save(doc);
    return this.mapRecord(saved);
  }

  public async findById(id: string): Promise<MemberLeaveRequestRecord | null> {
    const objectId = this.tryParseObjectId(id);
    if (!objectId) return null;
    const doc = await this.getRepo().findOneById(objectId);
    return doc ? this.mapRecord(doc) : null;
  }

  // Find the latest pending request for a member — prevents duplicate raises
  public async findPendingByMember(
    memberId: string,
    libraryId: string,
  ): Promise<MemberLeaveRequestRecord | null> {
    const docs = await this.getRepo().find({
      where: { memberId, libraryId, status: 'pending' },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return docs[0] ? this.mapRecord(docs[0]) : null;
  }

  public async findByIdAndLibrary(
    id: string,
    libraryId: string,
  ): Promise<MemberLeaveRequestRecord | null> {
    const objectId = this.tryParseObjectId(id);
    if (!objectId) return null;
    const doc = await this.getRepo().findOneById(objectId);
    if (!doc || doc.libraryId !== libraryId) return null;
    return this.mapRecord(doc);
  }

  public async updateRequest(
    id: string,
    input: UpdateLeaveRequestInput,
  ): Promise<MemberLeaveRequestRecord | null> {
    const objectId = this.tryParseObjectId(id);
    if (!objectId) return null;

    const repo = this.getRepo();
    const doc = await repo.findOneById(objectId);
    if (!doc) return null;

    doc.status          = input.status;
    doc.rejectionReason = input.rejectionReason ?? null;
    doc.resolvedAt      = input.resolvedAt ?? new Date();
    doc.updatedAt       = input.updatedAt  ?? new Date();

    const saved = await repo.save(doc);
    return this.mapRecord(saved);
  }

  public async listByLibrary(
    query: ListLeaveRequestsQuery,
  ): Promise<ListLeaveRequestsResult> {
    const filter: Record<string, unknown> = { libraryId: query.libraryId };
    if (query.status) filter.status = query.status;

    const [docs, total] = await Promise.all([
      this.getRepo().find({
        where: filter,
        order: { createdAt: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.getRepo().count({ where: filter }),
    ]);

    return { requests: docs.map(d => this.mapRecord(d)), total };
  }

  // Student: list their own leave requests across libraries
  public async listByStudent(studentId: string): Promise<MemberLeaveRequestRecord[]> {
    const docs = await this.getRepo().find({
      where: { studentId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return docs.map(d => this.mapRecord(d));
  }

  private mapRecord(doc: MemberLeaveRequestModel): MemberLeaveRequestRecord {
    return {
      id:              doc.id.toHexString(),
      memberId:        doc.memberId,
      studentId:       doc.studentId,
      libraryId:       doc.libraryId,
      bookingId:       doc.bookingId ?? null,
      reason:          doc.reason ?? null,
      status:          doc.status,
      rejectionReason: doc.rejectionReason ?? null,
      resolvedAt:      doc.resolvedAt ?? null,
      createdAt:       doc.createdAt,
      updatedAt:       doc.updatedAt,
    };
  }

  private tryParseObjectId(value: string): ObjectId | null {
    if (!ObjectId.isValid(value)) return null;
    return new ObjectId(value);
  }

  private getRepo(): MongoRepository<MemberLeaveRequestModel> {
    return getDataSource().getMongoRepository(MemberLeaveRequestModel);
  }
}