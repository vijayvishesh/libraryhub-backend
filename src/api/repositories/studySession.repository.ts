import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { StudySessionModel } from '../models/studySession.model';
import {
  CreateStudySessionInput,
  StudySessionRecord,
  UpdateStudySessionInput,
} from './types/studySession.repository.types';

@Service()
export class StudySessionRepository {
  private getRepo(): MongoRepository<StudySessionModel> {
    return getDataSource().getMongoRepository(StudySessionModel);
  }

  private toRecord(model: StudySessionModel): StudySessionRecord {
    return {
      id: model.id.toHexString(),
      studentId: model.studentId,
      libraryId: model.libraryId,
      studyDuration: model.studyDuration,
      startTime: model.startTime,
      endTime: model.endTime,
      durationMinutes: model.durationMinutes,
      notes: model.notes,
      revisionReminderDays: model.revisionReminderDays,
      revisionReminderDate: model.revisionReminderDate,
      deletedAt: model.deletedAt,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  public async findByStudent(studentId: string): Promise<StudySessionRecord[]> {
    const models = await this.getRepo().find({
      where: { studentId, deletedAt: null } as any,
      order: { createdAt: 'DESC' } as any,
    });
    return models.map(m => this.toRecord(m));
  }

  public async findById(id: string): Promise<StudySessionRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const model = await this.getRepo().findOneById(new ObjectId(id));
    return model ? this.toRecord(model) : null;
  }

  public async create(input: CreateStudySessionInput): Promise<StudySessionRecord> {
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
    input: UpdateStudySessionInput,
  ): Promise<StudySessionRecord | null> {
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