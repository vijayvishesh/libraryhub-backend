import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { StudyTimetableModel } from '../models/studyTimetable.model';
import {
  CreateStudyTimetableInput,
  StudyTimetableRecord,
  UpdateStudyTimetableInput,
} from './types/studyTimetable.repository.types';

@Service()
export class StudyTimetableRepository {
  private getRepo(): MongoRepository<StudyTimetableModel> {
    return getDataSource().getMongoRepository(StudyTimetableModel);
  }

  private toRecord(model: StudyTimetableModel): StudyTimetableRecord {
    return {
      id: model.id.toHexString(),
      studentId: model.studentId,
      title: model.title,
      subjects: model.subjects,
      isActive: model.isActive,
      deletedAt: model.deletedAt,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  public async findByStudent(studentId: string): Promise<StudyTimetableRecord[]> {
    const models = await this.getRepo().find({
      where: { studentId, deletedAt: null } as any,
    });
    return models.map(m => this.toRecord(m));
  }

  public async findById(id: string): Promise<StudyTimetableRecord | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }

    const model = await this.getRepo().findOneById(new ObjectId(id));
    return model ? this.toRecord(model) : null;
  }

  public async create(input: CreateStudyTimetableInput): Promise<StudyTimetableRecord> {
    const now = new Date();
    const repo = this.getRepo();
    const model = repo.create({
      ...input,
      isActive: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repo.save(model);
    return this.toRecord(saved);
  }

  public async update(
    id: string,
    input: UpdateStudyTimetableInput,
  ): Promise<StudyTimetableRecord | null> {
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
    return this.toRecord(saved);
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
    existing.updatedAt = new Date();
    await repo.save(existing);
    return true;
  }
}