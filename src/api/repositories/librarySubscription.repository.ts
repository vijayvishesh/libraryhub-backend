import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import {
  CreateLibrarySubscriptionInput,
  LibrarySubscriptionRecord,
  ListLibrarySubscriptionsQuery,
  ListLibrarySubscriptionsResult,
  UpdateLibrarySubscriptionInput,
} from './types/librarySubscription.repository.types';
import { LibrarySubscriptionModel } from '../models/librarySubscription.model';

@Service()
export class LibrarySubscriptionRepository {

  public async createSubscription(
    input: CreateLibrarySubscriptionInput,
  ): Promise<LibrarySubscriptionRecord> {
    const repo = this.getRepo();
    const now = new Date();
    const sub = repo.create({ ...input, createdAt: now, updatedAt: now });
    const saved = await repo.save(sub);
    return this.mapSub(saved);
  }

  public async findActiveByLibraryId(
    libraryId: string,
  ): Promise<LibrarySubscriptionRecord | null> {
    const today = new Date().toISOString().slice(0, 10);
    const subs = await this.getRepo().find({
      where: {
        libraryId,
        status: 'active',
        endDate: { $gte: today } as any,
      },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return subs[0] ? this.mapSub(subs[0]) : null;
  }

  public async findById(subscriptionId: string): Promise<LibrarySubscriptionRecord | null> {
    const objectId = this.tryParseObjectId(subscriptionId);
    if (!objectId) return null;
    const sub = await this.getRepo().findOneById(objectId);
    if (!sub) return null;
    return this.mapSub(sub);
  }

  public async findLatestByLibraryId(
    libraryId: string,
  ): Promise<LibrarySubscriptionRecord | null> {
    const subs = await this.getRepo().find({
      where: { libraryId },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return subs[0] ? this.mapSub(subs[0]) : null;
  }

  public async listSubscriptions(
    query: ListLibrarySubscriptionsQuery,
  ): Promise<ListLibrarySubscriptionsResult> {
    const filter: Record<string, unknown> = {};
    if (query.libraryId)   filter.libraryId   = query.libraryId;
    if (query.status)      filter.status      = query.status;
    if (query.activatedBy) filter.activatedBy = query.activatedBy;

    const [subs, total] = await Promise.all([
      this.getRepo().find({
        where: filter,
        order: { createdAt: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.getRepo().count({ where: filter }),
    ]);

    return { subscriptions: subs.map(s => this.mapSub(s)), total };
  }

  public async updateSubscription(
    subscriptionId: string,
    input: UpdateLibrarySubscriptionInput,
  ): Promise<LibrarySubscriptionRecord | null> {
    const objectId = this.tryParseObjectId(subscriptionId);
    if (!objectId) return null;

    const repo = this.getRepo();
    const sub = await repo.findOneById(objectId);
    if (!sub) return null;

    if (input.planId          !== undefined) sub.planId          = input.planId;
    if (input.planName        !== undefined) sub.planName        = input.planName;
    if (input.features        !== undefined) sub.features        = input.features;
    if (input.status          !== undefined) sub.status          = input.status;
    if (input.startDate       !== undefined) sub.startDate       = input.startDate;
    if (input.endDate         !== undefined) sub.endDate         = input.endDate;
    if (input.amount          !== undefined) sub.amount          = input.amount;
    if (input.paymentMethod   !== undefined) sub.paymentMethod   = input.paymentMethod;
    if (input.paymentReference !== undefined) sub.paymentReference = input.paymentReference;
    if (input.notes           !== undefined) sub.notes           = input.notes;
    sub.updatedAt = input.updatedAt || new Date();

    const saved = await repo.save(sub);
    return this.mapSub(saved);
  }

  // Expire all active subscriptions for a library (used before activating new one)
  public async expireActiveSubscriptions(libraryId: string): Promise<void> {
    await this.getRepo().updateMany(
      { libraryId, status: 'active' } as any,
      { $set: { status: 'expired', updatedAt: new Date() } },
    );
  }

  // Super admin: expire active subscriptions for ALL libraries
  public async expireAllActiveSubscriptions(): Promise<void> {
    await this.getRepo().updateMany(
      { status: 'active' } as any,
      { $set: { status: 'expired', updatedAt: new Date() } },
    );
  }

  // ── Private ─────────────────────────────────────────────────────────

  private mapSub(sub: LibrarySubscriptionModel): LibrarySubscriptionRecord {
    return {
      id:               sub.id.toHexString(),
      libraryId:        sub.libraryId,
      planId:           sub.planId,
      planName:         sub.planName,
      features:         sub.features,
      status:           sub.status,
      activatedBy:      sub.activatedBy,
      startDate:        sub.startDate,
      endDate:          sub.endDate,
      amount:           sub.amount,
      paymentMethod:    sub.paymentMethod,
      paymentReference: sub.paymentReference,
      notes:            sub.notes,
      createdAt:        sub.createdAt,
      updatedAt:        sub.updatedAt,
    };
  }

  private tryParseObjectId(value: string): ObjectId | null {
    if (!ObjectId.isValid(value)) return null;
    return new ObjectId(value);
  }

  private getRepo(): MongoRepository<LibrarySubscriptionModel> {
    return getDataSource().getMongoRepository(LibrarySubscriptionModel);
  }
}