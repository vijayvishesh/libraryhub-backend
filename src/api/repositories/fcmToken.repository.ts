import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { FcmTokenModel } from '../models/fcmToken.model';
import { FcmTokenRecord, UpsertFcmTokenInput } from './types/fcmToken.repository.types';

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
    console.log('🔍 Querying tokens for studentIds:', studentIds);

    const allTokens = await this.getRepo().find({});
    console.log('🔍 ALL tokens in DB:', allTokens.map(m => ({ studentId: m.studentId, token: m.token.slice(0, 20) })));

    const models = await this.getRepo().find({
      where: { studentId: { $in: studentIds } } as any,
    });
    console.log('🔍 Matched tokens:', models.length);
    return models.map(m => m.token);
  }

  // ✅ Upsert by TOKEN (device) so switching students on same device works correctly
  public async upsert(input: UpsertFcmTokenInput): Promise<FcmTokenRecord> {
    const repo = this.getRepo();
    const now = new Date();

    // Find by token (device identifier) instead of studentId + deviceType
    // This ensures when a new student logs in on the same device,
    // the token gets reassigned to the new student correctly
    const existing = await repo.findOne({
      where: { token: input.token } as any,
    });

    if (existing) {
      existing.studentId = input.studentId;
      existing.deviceType = input.deviceType;
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

  // ✅ Deletes invalid/expired tokens after FCM send failure
  public async deleteByTokens(tokens: string[]): Promise<void> {
    await this.getRepo().deleteMany({ token: { $in: tokens } } as any);
  }
}