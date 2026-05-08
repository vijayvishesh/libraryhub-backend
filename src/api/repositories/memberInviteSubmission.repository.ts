import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { MemberInviteSubmissionModel } from '../models/memberInviteSubmission.model';
import {
  CreateSubmissionInput,
  ListSubmissionsQuery,
  ListSubmissionsResult,
  SubmissionRecord,
  UpdateSubmissionInput,
} from './types/memberInviteSubmission.repository.types';

@Service()
export class MemberInviteSubmissionRepository {
  private getRepo(): MongoRepository<MemberInviteSubmissionModel> {
    return getDataSource().getMongoRepository(MemberInviteSubmissionModel);
  }

  private map(model: MemberInviteSubmissionModel): SubmissionRecord {
    return {
      id: model.id.toHexString(),
      inviteLinkId: model.inviteLinkId,
      inviteLinkToken: model.inviteLinkToken,
      libraryId: model.libraryId,
      ownerId: model.ownerId,
      fullName: model.fullName,
      mobileNo: model.mobileNo,
      gender: model.gender,
      startDate: model.startDate,
      endDate: model.endDate,
      seatId: model.seatId ?? null,
      slotId: model.slotId ?? null,
      status: model.status,
      rejectionReason: model.rejectionReason ?? null,
      studentId: model.studentId ?? null,
      memberId: model.memberId ?? null,
      reviewedAt: model.reviewedAt ?? null,
      reviewedBy: model.reviewedBy ?? null,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      isInviteSubmission: model.isInviteSubmission ?? true,
      isNewUser: model.isNewUser ?? false,
      isExistingMember: model.isExistingMember ?? false,
      hasPendingFee: model.hasPendingFee ?? false,
      pendingFeeAmount: model.pendingFeeAmount ?? null,
      previousEndDate: model.previousEndDate ?? null,
      isDuplicate: model.isDuplicate ?? false,
      bookingId: model.bookingId ?? null,
    };
  }

  public async create(input: CreateSubmissionInput): Promise<SubmissionRecord> {
    const repo = this.getRepo();
    const now = new Date();
    const model = repo.create({
      ...input,
      status: 'pending',
      rejectionReason: null,
      studentId: null,
      memberId: null,
      reviewedAt: null,
      reviewedBy: null,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repo.save(model);
    return this.map(saved);
  }

  public async findById(id: string): Promise<SubmissionRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const model = await this.getRepo().findOneById(new ObjectId(id));
    return model ? this.map(model) : null;
  }

  public async findByIdAndLibrary(
    id: string,
    libraryId: string,
  ): Promise<SubmissionRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const model = await this.getRepo().findOneById(new ObjectId(id));
    if (!model || model.libraryId !== libraryId) return null;
    return this.map(model);
  }

  public async list(query: ListSubmissionsQuery): Promise<ListSubmissionsResult> {
    const where: Record<string, unknown> = { libraryId: query.libraryId };
    if (query.status) where.status = query.status;

    const [models, total] = await Promise.all([
      this.getRepo().find({
        where: where as any,
        order: { createdAt: 'DESC' } as any,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.getRepo().count({ where: where as any }),
    ]);

    return { submissions: models.map(m => this.map(m)), total };
  }

  public async update(
    id: string,
    libraryId: string,
    input: UpdateSubmissionInput,
  ): Promise<SubmissionRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const repo = this.getRepo();
    const model = await repo.findOneById(new ObjectId(id));
    if (!model || model.libraryId !== libraryId) return null;

    Object.assign(model, input, { updatedAt: new Date() });
    const saved = await repo.save(model);
    return this.map(saved);
  }

  // Bulk update for approve/reject all
  public async bulkUpdateStatus(
    ids: string[],
    libraryId: string,
    status: 'approved' | 'rejected',
    reviewedBy: string,
    rejectionReason?: string,
  ): Promise<number> {
    const repo = this.getRepo();
    const objectIds = ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    const now = new Date();
    let updatedCount = 0;

    await Promise.all(
      objectIds.map(async oid => {
        const model = await repo.findOneById(oid);
        if (!model || model.libraryId !== libraryId || model.status !== 'pending') return;
        model.status = status;
        model.reviewedAt = now;
        model.reviewedBy = reviewedBy;
        model.rejectionReason = rejectionReason ?? null;
        model.updatedAt = now;
        await repo.save(model);
        updatedCount++;
      }),
    );

    return updatedCount;
  }

  // Get all pending for a library (for approve-all)
  public async findAllPendingByLibrary(libraryId: string): Promise<SubmissionRecord[]> {
    const models = await this.getRepo().find({
      where: { libraryId, status: 'pending' } as any,
      order: { createdAt: 'ASC' } as any,
    });
    return models.map(m => this.map(m));
  }

public async findByMemberIds(memberIds: string[]): Promise<Map<string, SubmissionRecord>> {
  if (!memberIds.length) return new Map();

  const validObjectIds = memberIds
    .filter(id => ObjectId.isValid(id))
    .map(id => new ObjectId(id));

  if (!validObjectIds.length) return new Map();

  const models = await this.getRepo().find({
    where: {
      memberId: { $in: memberIds } as any,
    } as any,
  });

  const resultMap = new Map<string, SubmissionRecord>();
  for (const model of models) {
    if (model.memberId) {
      resultMap.set(model.memberId, this.map(model));
    }
  }

  return resultMap;
}
}