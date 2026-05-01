import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { AnnouncementModel } from '../models/announcement.model';
import {
  AnnouncementRecord,
  CreateAnnouncementInput,
} from './types/announcement.repository.types';

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
      deletedAt: model.deletedAt,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  public async findByLibrary(libraryId: string): Promise<AnnouncementRecord[]> {
    const models = await this.getRepo().find({
      where: { libraryId, deletedAt: null } as any,
      order: { createdAt: 'DESC' } as any,
    });
    return models.map(m => this.toRecord(m));
  }

  public async findById(id: string): Promise<AnnouncementRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const model = await this.getRepo().findOneById(new ObjectId(id));
    return model ? this.toRecord(model) : null;
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
    return this.toRecord(saved);
  }
  public async update(
  id: string,
  input: Partial<CreateAnnouncementInput>,
): Promise<AnnouncementRecord | null> {
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