import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { AttendanceModel } from '../models/attendance.model';
import {
  AttendanceRecord,
  CreateAttendanceInput,
  UpdateAttendanceInput,
} from './types/attendance.repository.types';

@Service()
export class AttendanceRepository {
  private getRepo(): MongoRepository<AttendanceModel> {
    return getDataSource().getMongoRepository(AttendanceModel);
  }

  private toRecord(model: AttendanceModel): AttendanceRecord {
    return {
      id: model.id.toHexString(),
      studentId: model.studentId,
      libraryId: model.libraryId,
      membershipId: model.membershipId,
      seatId: model.seatId,
      studentName: model.studentName,
      date: model.date,
      checkInTime: model.checkInTime,
      checkOutTime: model.checkOutTime,
      status: model.status,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  public async findTodayByStudentAndLibrary(
    studentId: string,
    libraryId: string,
    date: string,
  ): Promise<AttendanceRecord | null> {
    const model = await this.getRepo().findOne({
      where: { studentId, libraryId, date } as any,
    });
    return model ? this.toRecord(model) : null;
  }

  public async findById(id: string): Promise<AttendanceRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const model = await this.getRepo().findOneById(new ObjectId(id));
    return model ? this.toRecord(model) : null;
  }

  public async findTodayByLibrary(
    libraryId: string,
    date: string,
  ): Promise<AttendanceRecord[]> {
    const models = await this.getRepo().find({
      where: { libraryId, date } as any,
      order: { checkInTime: 'DESC' } as any,
    });
    return models.map(m => this.toRecord(m));
  }

  public async create(input: CreateAttendanceInput): Promise<AttendanceRecord> {
    const now = new Date();
    const repo = this.getRepo();
    const model = repo.create({
      ...input,
      checkOutTime: null,
      status: 'checked_in',
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repo.save(model);
    return this.toRecord(saved);
  }

  public async update(
    id: string,
    input: UpdateAttendanceInput,
  ): Promise<AttendanceRecord | null> {
    if (!ObjectId.isValid(id)) return null;
    const repo = this.getRepo();
    const existing = await repo.findOneById(new ObjectId(id));
    if (!existing) return null;
    Object.assign(existing, input, { updatedAt: new Date() });
    const saved = await repo.save(existing);
    return this.toRecord(saved);
  }
}