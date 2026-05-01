import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { BannerModel } from '../models/banner.model';
import {
  BannerRecord,
  CreateBannerInput,
  UpdateBannerInput,
} from './types/banner.repository.types';

@Service()
export class BannerRepository {
  private getRepo(): MongoRepository<BannerModel> {
    return getDataSource().getMongoRepository(BannerModel);
  }

  private toRecord(model: BannerModel): BannerRecord {
    return {
      id: model.id.toHexString(),
      title: model.title,
      details: model.details,
      imageUrl: model.imageUrl,
      redirectUrl: model.redirectUrl,
      sponsorName: model.sponsorName,
      startDate: model.startDate,
      endDate: model.endDate,
      durationValue: model.durationValue,
      durationUnit: model.durationUnit,
      priority: model.priority,
      isActive: model.isActive,
      deletedAt: model.deletedAt,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  public async findAll(): Promise<BannerRecord[]> {
    const models = await this.getRepo().find({
      where: { deletedAt: null } as any,
      order: { priority: 'ASC', createdAt: 'DESC' } as any,
    });
    return models.map(m => this.toRecord(m));
  }

  public async findActiveBanners(today: string): Promise<BannerRecord[]> {
    const models = await this.getRepo().find({
      where: {
        isActive: true,
        deletedAt: null,
        startDate: { $lte: today } as any,
        endDate: { $gte: today } as any,
      } as any,
      order: { priority: 'ASC' } as any,
    });
    return models.map(m => this.toRecord(m));
  }

  public async findById(id: string): Promise<BannerRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const model = await this.getRepo().findOneById(new ObjectId(id));
    return model ? this.toRecord(model) : null;
  }

  public async create(input: CreateBannerInput): Promise<BannerRecord> {
    const now = new Date();
    const repo = this.getRepo();
    const model = repo.create({
      ...input,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repo.save(model);
    return this.toRecord(saved);
  }

  public async update(
    id: string,
    input: UpdateBannerInput,
  ): Promise<BannerRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const repo = this.getRepo();
    const existing = await repo.findOneById(new ObjectId(id));
    if (!existing) return null;
    Object.assign(existing, input, { updatedAt: new Date() });
    const saved = await repo.save(existing);
    return this.toRecord(saved);
  }

  public async softDelete(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const repo = this.getRepo();
    const existing = await repo.findOneById(new ObjectId(id));
    if (!existing) return false;
    existing.deletedAt = new Date();
    existing.updatedAt = new Date();
    await repo.save(existing);
    return true;
  }
}