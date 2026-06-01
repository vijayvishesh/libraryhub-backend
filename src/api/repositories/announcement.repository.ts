import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { AnnouncementModel } from '../models/announcement.model';
import { AnnouncementRecord, CreateAnnouncementInput } from './types/announcement.repository.types';

@Service()
export class AnnouncementRepository {
  private getRepo(): MongoRepository<AnnouncementModel> {
    return getDataSource().getMongoRepository(AnnouncementModel);
  }

  private toRecord(model: AnnouncementModel): AnnouncementRecord {
    return {
      id: model.id.toHexString(),
      libraryId: model.libraryId,
      ownerId: model.ownerId,
      title: model.title,
      message: model.message,
      target: model.target,
      sentCount: model.sentCount,
      isActive: model.isActive ?? true,
      memberIds: model.memberIds ?? null,
      expiresAt: model.expiresAt ?? null,
      expiryUnit: model.expiryUnit ?? null,
      expiryValue: model.expiryValue ?? null,
      deletedAt: model.deletedAt ?? null,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  // Auto-deactivate expired announcements before returning
  private resolveIsActive(record: AnnouncementRecord): AnnouncementRecord {
    if (!record.isActive) {
      return record;
    }
    if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
      return { ...record, isActive: false };
    }
    return record;
  }

  public async findByLibrary(libraryId: string): Promise<AnnouncementRecord[]> {
    const models = await this.getRepo().find({
      where: { libraryId, deletedAt: null } as any,
      order: { createdAt: 'DESC' } as any,
      take: 100,
    });
    return models.map(m => this.resolveIsActive(this.toRecord(m)));
  }

  public async findById(id: string): Promise<AnnouncementRecord | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }
    const model = await this.getRepo().findOneById(new ObjectId(id));
    return model ? this.resolveIsActive(this.toRecord(model)) : null;
  }

  public async create(input: CreateAnnouncementInput): Promise<AnnouncementRecord> {
    const now = new Date();
    const repo = this.getRepo();
    const model = repo.create({
      ...input,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repo.save(model);
    return this.resolveIsActive(this.toRecord(saved));
  }

  public async update(
    id: string,
    input: Partial<CreateAnnouncementInput>,
  ): Promise<AnnouncementRecord | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }
    const repo = this.getRepo();
    const existing = await repo.findOneById(new ObjectId(id));
    if (!existing) {
      return null;
    }
    Object.assign(existing, input, { updatedAt: new Date() });
    const saved = await repo.save(existing);
    return this.resolveIsActive(this.toRecord(saved));
  }

  // Toggle active/inactive manually
  public async setActive(id: string, isActive: boolean): Promise<AnnouncementRecord | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }
    const repo = this.getRepo();
    const existing = await repo.findOneById(new ObjectId(id));
    if (!existing) {
      return null;
    }
    existing.isActive = isActive;
    existing.updatedAt = new Date();
    const saved = await repo.save(existing);
    return this.resolveIsActive(this.toRecord(saved));
  }

  public async softDelete(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
      return false;
    }
    const repo = this.getRepo();
    const existing = await repo.findOneById(new ObjectId(id));
    if (!existing) {
      return false;
    }
    existing.deletedAt = new Date();
    existing.isActive = false;
    existing.updatedAt = new Date();
    await repo.save(existing);
    return true;
  }
}
