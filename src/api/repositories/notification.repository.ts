import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { NotificationModel } from '../models/notification.model';
import {
  CreateNotificationInput,
  NotificationRecord,
} from './types/notification.repository.types';

@Service()
export class NotificationRepository {
  private getRepo(): MongoRepository<NotificationModel> {
    return getDataSource().getMongoRepository(NotificationModel);
  }

  private toRecord(model: NotificationModel): NotificationRecord {
    return {
      id: model.id.toHexString(),
      studentId: model.studentId ?? null,
      ownerId: model.ownerId ?? null,
      title: model.title,
      message: model.message,
      type: model.type,
      referenceId: model.referenceId,
      isRead: model.isRead,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  // ── Student methods (unchanged) ──────────────────────────────────────────

  public async findByStudent(studentId: string): Promise<NotificationRecord[]> {
    const models = await this.getRepo().find({
      where: { studentId } as any,
      order: { createdAt: 'DESC' } as any,
    });
    return models.map(m => this.toRecord(m));
  }

  public async countUnread(studentId: string): Promise<number> {
    return this.getRepo().count({
      where: { studentId, isRead: false } as any,
    });
  }

  public async findById(id: string): Promise<NotificationRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const model = await this.getRepo().findOneById(new ObjectId(id));
    return model ? this.toRecord(model) : null;
  }

  public async createMany(inputs: CreateNotificationInput[]): Promise<void> {
    const now = new Date();
    const repo = this.getRepo();
    const models = inputs.map(input =>
      repo.create({
        studentId: input.studentId ?? null,
        ownerId: input.ownerId ?? null,
        title: input.title,
        message: input.message,
        type: input.type,
        referenceId: input.referenceId ?? null,
        isRead: false,
        createdAt: now,
        updatedAt: now,
      }),
    );
    await repo.save(models);
  }

  public async markAsRead(id: string): Promise<NotificationRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const repo = this.getRepo();
    const existing = await repo.findOneById(new ObjectId(id));
    if (!existing) return null;
    existing.isRead = true;
    existing.updatedAt = new Date();
    const saved = await repo.save(existing);
    return this.toRecord(saved);
  }

  public async markAllAsRead(studentId: string): Promise<void> {
    await this.getRepo().updateMany(
      { studentId, isRead: false } as any,
      { $set: { isRead: true, updatedAt: new Date() } } as any,
    );
  }

  // ── Owner methods (new) ──────────────────────────────────────────────────

  public async findByOwner(ownerId: string): Promise<NotificationRecord[]> {
    const models = await this.getRepo().find({
      where: { ownerId } as any,
      order: { createdAt: 'DESC' } as any,
    });
    return models.map(m => this.toRecord(m));
  }

  public async countUnreadByOwner(ownerId: string): Promise<number> {
    return this.getRepo().count({
      where: { ownerId, isRead: false } as any,
    });
  }

  public async markAsReadByOwner(id: string, ownerId: string): Promise<NotificationRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const repo = this.getRepo();
    const existing = await repo.findOneById(new ObjectId(id));
    if (!existing || existing.ownerId !== ownerId) return null;
    existing.isRead = true;
    existing.updatedAt = new Date();
    const saved = await repo.save(existing);
    return this.toRecord(saved);
  }

  public async markAllAsReadByOwner(ownerId: string): Promise<void> {
    await this.getRepo().updateMany(
      { ownerId, isRead: false } as any,
      { $set: { isRead: true, updatedAt: new Date() } } as any,
    );
  }

  public async createOwnerNotification(input: CreateNotificationInput): Promise<void> {
    const now = new Date();
    const repo = this.getRepo();
    await repo.save(
      repo.create({
        studentId: null,
        ownerId: input.ownerId ?? null,
        title: input.title,
        message: input.message,
        type: input.type,
        referenceId: input.referenceId ?? null,
        isRead: false,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
}