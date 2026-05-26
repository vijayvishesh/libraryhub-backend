import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { MemberRenewalModel } from '../models/memberRenewal.model';
import {
  CreateMemberRenewalInput,
  ListMemberRenewalsQuery,
  ListMemberRenewalsResult,
  MemberRenewalRecord,
  UpdateMemberRenewalInput,
} from './types/memberRenewal.repository.types';

@Service()
export class MemberRenewalRepository {

  public async createRenewal(input: CreateMemberRenewalInput): Promise<MemberRenewalRecord> {
    const repo = this.getRenewalRepository();
    const now = new Date();
    const renewal = repo.create({
      ...input,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repo.save(renewal);
    return this.mapRenewal(saved);
  }

  public async findRenewalById(renewalId: string): Promise<MemberRenewalRecord | null> {
    const objectId = this.tryParseObjectId(renewalId);
    if (!objectId) return null;

    const renewal = await this.getRenewalRepository().findOneById(objectId);
    if (!renewal) return null;

    return this.mapRenewal(renewal);
  }

  public async findLatestRenewalByMember(
    memberId: string,
    libraryId: string,
  ): Promise<MemberRenewalRecord | null> {
    const renewals = await this.getRenewalRepository().find({
      where: { memberId, libraryId },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return renewals[0] ? this.mapRenewal(renewals[0]) : null;
  }

  public async listRenewalsByMember(
    query: ListMemberRenewalsQuery,
  ): Promise<ListMemberRenewalsResult> {
    const filter: Record<string, unknown> = {};

    if (query.memberId)  filter.memberId  = query.memberId;
    if (query.studentId) filter.studentId = query.studentId;
    if (query.libraryId) filter.libraryId = query.libraryId;
    if (query.status)    filter.status    = query.status;

    const [renewals, total] = await Promise.all([
      this.getRenewalRepository().find({
        where: filter,
        order: { createdAt: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.getRenewalRepository().count({ where: filter }),
    ]);

    return {
      renewals: renewals.map(r => this.mapRenewal(r)),
      total,
    };
  }

  // Called when owner approves a pending renewal
  public async updateRenewalByIdAndLibrary(
    renewalId: string,
    libraryId: string,
    input: UpdateMemberRenewalInput,
  ): Promise<MemberRenewalRecord | null> {
    const objectId = this.tryParseObjectId(renewalId);
    if (!objectId) return null;

    const repo = this.getRenewalRepository();
    const renewal = await repo.findOneById(objectId);
    if (!renewal || renewal.libraryId !== libraryId) return null;

    if (input.status      !== undefined) renewal.status      = input.status;
    if (input.newBookingId !== undefined) renewal.newBookingId = input.newBookingId;

    renewal.updatedAt = input.updatedAt || new Date();
    const saved = await repo.save(renewal);
    return this.mapRenewal(saved);
  }

  // Owner: list all pending renewals for their library
  public async listPendingRenewalsByLibrary(
    libraryId: string,
  ): Promise<MemberRenewalRecord[]> {
    const renewals = await this.getRenewalRepository().find({
      where: { libraryId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });
    return renewals.map(r => this.mapRenewal(r));
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private mapRenewal(renewal: MemberRenewalModel): MemberRenewalRecord {
    return {
      id:                 renewal.id.toHexString(),
      memberId:           renewal.memberId,
      studentId:          renewal.studentId,
      libraryId:          renewal.libraryId,
      previousBookingId:  renewal.previousBookingId ?? null,
      previousSeatId:     renewal.previousSeatId    ?? null,
      previousSlotId:     renewal.previousSlotId    ?? null,
      previousEndDate:    renewal.previousEndDate   ?? null,
      newBookingId:       renewal.newBookingId      ?? null,
      newSeatId:          renewal.newSeatId,
      newSlotId:          renewal.newSlotId,
      newSlotName:        renewal.newSlotName,
      newStartDate:       renewal.newStartDate,
      newEndDate:         renewal.newEndDate,
      duration:           renewal.duration,
      planAmount:         renewal.planAmount,
      paymentMethod:      renewal.paymentMethod,
      renewedBy:          renewal.renewedBy,
      status:             renewal.status,
      createdAt:          renewal.createdAt,
      updatedAt:          renewal.updatedAt,
    };
  }

  private tryParseObjectId(value: string): ObjectId | null {
    if (!ObjectId.isValid(value)) return null;
    return new ObjectId(value);
  }

  private getRenewalRepository(): MongoRepository<MemberRenewalModel> {
    return getDataSource().getMongoRepository(MemberRenewalModel);
  }
}