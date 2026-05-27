import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { SubscriptionPlanModel } from '../models/subscriptionPlan.model';
import {
  CreateSubscriptionPlanInput,
  SubscriptionPlanRecord,
  UpdateSubscriptionPlanInput,
} from './types/subscriptionPlan.repository.types';

@Service()
export class SubscriptionPlanRepository {

  public async createPlan(input: CreateSubscriptionPlanInput): Promise<SubscriptionPlanRecord> {
    const repo = this.getRepo();
    const now = new Date();
    const plan = repo.create({ ...input, createdAt: now, updatedAt: now });
    const saved = await repo.save(plan);
    return this.mapPlan(saved);
  }

  public async findPlanById(planId: string): Promise<SubscriptionPlanRecord | null> {
    const objectId = this.tryParseObjectId(planId);
    if (!objectId) return null;
    const plan = await this.getRepo().findOneById(objectId);
    if (!plan) return null;
    return this.mapPlan(plan);
  }

  public async listAllPlans(onlyActive = false): Promise<SubscriptionPlanRecord[]> {
    const where = onlyActive ? { isActive: true } : {};
    const plans = await this.getRepo().find({
      where,
      order: { sortOrder: 'ASC' },
    });
    return plans.map(p => this.mapPlan(p));
  }

  public async updatePlan(
    planId: string,
    input: UpdateSubscriptionPlanInput,
  ): Promise<SubscriptionPlanRecord | null> {
    const objectId = this.tryParseObjectId(planId);
    if (!objectId) return null;

    const repo = this.getRepo();
    const plan = await repo.findOneById(objectId);
    if (!plan) return null;

    if (input.name        !== undefined) plan.name        = input.name;
    if (input.description !== undefined) plan.description = input.description;
    if (input.price       !== undefined) plan.price       = input.price;
    if (input.durationDays !== undefined) plan.durationDays = input.durationDays;
    if (input.features    !== undefined) plan.features    = input.features;
    if (input.isActive    !== undefined) plan.isActive    = input.isActive;
    if (input.sortOrder   !== undefined) plan.sortOrder   = input.sortOrder;
    plan.updatedAt = input.updatedAt || new Date();

    const saved = await repo.save(plan);
    return this.mapPlan(saved);
  }

  public async deletePlan(planId: string): Promise<boolean> {
    const objectId = this.tryParseObjectId(planId);
    if (!objectId) return false;
    const repo = this.getRepo();
    const plan = await repo.findOneById(objectId);
    if (!plan) return false;
    await repo.delete(objectId);
    return true;
  }

  // ── Private ─────────────────────────────────────────────────────────

  private mapPlan(plan: SubscriptionPlanModel): SubscriptionPlanRecord {
    return {
      id:          plan.id.toHexString(),
      name:        plan.name,
      description: plan.description,
      price:       plan.price,
      durationDays:plan.durationDays,
      features:    plan.features,
      isActive:    plan.isActive,
      sortOrder:   plan.sortOrder,
      createdAt:   plan.createdAt,
      updatedAt:   plan.updatedAt,
    };
  }

  private tryParseObjectId(value: string): ObjectId | null {
    if (!ObjectId.isValid(value)) return null;
    return new ObjectId(value);
  }

  private getRepo(): MongoRepository<SubscriptionPlanModel> {
    return getDataSource().getMongoRepository(SubscriptionPlanModel);
  }
}