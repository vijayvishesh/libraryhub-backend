import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { DataSource, Repository } from 'typeorm';
import { StudyTimetableModel } from '../models/studyTimetable.model';
import {
  CreateStudyTimetableInput,
  StudyTimetableRecord,
  UpdateStudyTimetableInput,
} from './types/studyTimetable.repository.types';

@Service()
export class StudyTimetableRepository {
  private readonly repo: Repository<StudyTimetableModel>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(StudyTimetableModel);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

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

  // ─── Queries ───────────────────────────────────────────────────────────────

  async findByStudentAndLibrary(
    studentId: string,
  ): Promise<StudyTimetableRecord[]> {
    const models = await this.repo.find({
      where: { studentId, deletedAt: null } as any,
    });
    return models.map(this.toRecord);
  }

  async findByStudent(studentId: string): Promise<StudyTimetableRecord[]> {
    const models = await this.repo.find({
      where: { studentId, deletedAt: null } as any,
    });
    return models.map(this.toRecord);
  }

  async findById(id: string): Promise<StudyTimetableRecord | null> {
    const model = await this.repo.findOne({
      where: { id: new ObjectId(id) } as any,
    });
    return model ? this.toRecord(model) : null;
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  async create(input: CreateStudyTimetableInput): Promise<StudyTimetableRecord> {
    const now = new Date();
    const model = this.repo.create({
      ...input,
      isActive: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await this.repo.save(model);
    return this.toRecord(saved);
  }

  async update(
    id: string,
    input: UpdateStudyTimetableInput,
  ): Promise<StudyTimetableRecord | null> {
    const existing = await this.repo.findOne({
      where: { id: new ObjectId(id) } as any,
    });

    if (!existing) return null;

    Object.assign(existing, input, { updatedAt: new Date() });
    const saved = await this.repo.save(existing);
    return this.toRecord(saved);
  }

  async softDelete(id: string): Promise<boolean> {
    const existing = await this.repo.findOne({
      where: { id: new ObjectId(id) } as any,
    });

    if (!existing) return false;

    existing.deletedAt = new Date();
    existing.updatedAt = new Date();
    await this.repo.save(existing);
    return true;
  }
}