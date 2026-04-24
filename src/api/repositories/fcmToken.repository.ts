import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { FcmTokenModel } from '../models/fcmToken.model';
import {
  FcmTokenRecord,
  UpsertFcmTokenInput,
} from './types/fcmToken.repository.types';

@Service()
export class FcmTokenRepository {
  private getRepo(): MongoRepository<FcmTokenModel> {
    return getDataSource().getMongoRepository(FcmTokenModel);
  }

  private toRecord(model: FcmTokenModel): FcmTokenRecord {
    return {
      id: model.id.toHexString(),
      studentId: model.studentId,
      token: model.token,
      deviceType: model.deviceType,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  public async findByStudentId(studentId: string): Promise<FcmTokenRecord[]> {
    const models = await this.getRepo().find({
      where: { studentId } as any,
    });
    return models.map(m => this.toRecord(m));
  }

  public async findTokensByStudentIds(studentIds: string[]): Promise<string[]> {
    const models = await this.getRepo().find({
      where: { studentId: { $in: studentIds } } as any,
    });
    return models.map(m => m.token);
  }

  public async upsert(input: UpsertFcmTokenInput): Promise<FcmTokenRecord> {
    const repo = this.getRepo();
    const existing = await repo.findOne({
      where: { studentId: input.studentId, deviceType: input.deviceType } as any,
    });

    const now = new Date();

    if (existing) {
      existing.token = input.token;
      existing.updatedAt = now;
      const saved = await repo.save(existing);
      return this.toRecord(saved);
    }

    const model = repo.create({
      ...input,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repo.save(model);
    return this.toRecord(saved);
  }

  public async deleteByStudentId(studentId: string): Promise<void> {
    await this.getRepo().deleteMany({ studentId } as any);
  }
}