import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { LibraryTransferModel } from '../models/libraryTransfer.model';
import {
  CreateLibraryTransferInput,
  LibraryTransferRecord,
} from './types/libraryTransfer.repository.types';

@Service()
export class LibraryTransferRepository {
  private getRepo(): MongoRepository<LibraryTransferModel> {
    return getDataSource().getMongoRepository(LibraryTransferModel);
  }

  private toRecord(model: LibraryTransferModel): LibraryTransferRecord {
    return {
      id: model.id.toHexString(),
      libraryId: model.libraryId,
      oldOwnerId: model.oldOwnerId,
      oldOwnerPhone: model.oldOwnerPhone,
      newOwnerName: model.newOwnerName,
      newOwnerPhone: model.newOwnerPhone,
      newOwnerEmail: model.newOwnerEmail,
      newOwnerPassword: model.newOwnerPassword,
      keepLibraryName: model.keepLibraryName,
      newLibraryName: model.newLibraryName,
      notifyStudents: model.notifyStudents,
      oldOwnerOtp: model.oldOwnerOtp,
      newOwnerOtp: model.newOwnerOtp,
      otpExpiresAt: model.otpExpiresAt,
      status: model.status,
      newOwnerId: model.newOwnerId,
      completedAt: model.completedAt,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  public async create(input: CreateLibraryTransferInput): Promise<LibraryTransferRecord> {
    const repo = this.getRepo();
    const now = new Date();
    const model = repo.create({
      ...input,
      status: 'pending_otp',
      newOwnerId: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repo.save(model);
    return this.toRecord(saved);
  }

  public async findPendingByLibraryId(
    libraryId: string,
  ): Promise<LibraryTransferRecord | null> {
    const model = await this.getRepo().findOne({
      where: { libraryId, status: 'pending_otp' } as any,
      order: { createdAt: 'DESC' } as any,
    });
    return model ? this.toRecord(model) : null;
  }

  public async findById(id: string): Promise<LibraryTransferRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const model = await this.getRepo().findOneById(new ObjectId(id));
    return model ? this.toRecord(model) : null;
  }

  public async complete(
    id: string,
    newOwnerId: string,
  ): Promise<LibraryTransferRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const repo = this.getRepo();
    const model = await repo.findOneById(new ObjectId(id));
    if (!model) return null;
    const now = new Date();
    model.status = 'completed';
    model.newOwnerId = newOwnerId;
    model.completedAt = now;
    model.updatedAt = now;
    const saved = await repo.save(model);
    return this.toRecord(saved);
  }

  public async cancelPendingByLibraryId(libraryId: string): Promise<void> {
    const repo = this.getRepo();
    const pending = await repo.find({
      where: { libraryId, status: 'pending_otp' } as any,
    });
    await Promise.all(
      pending.map(async model => {
        model.status = 'cancelled';
        model.updatedAt = new Date();
        await repo.save(model);
      }),
    );
  }

  public async findByLibraryId(libraryId: string): Promise<LibraryTransferRecord[]> {
    const models = await this.getRepo().find({
      where: { libraryId } as any,
      order: { createdAt: 'DESC' } as any,
    });
    return models.map(m => this.toRecord(m));
  }
}