import { NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { StudyTimetableRepository } from '../repositories/studyTimetable.repository';
import {
  CreateStudyTimetableInput,
  StudyTimetableRecord,
  UpdateStudyTimetableInput,
} from '../repositories/types/studyTimetable.repository.types';

@Service()
export class StudyTimetableService {
  constructor(
    private readonly studyTimetableRepository: StudyTimetableRepository,
  ) {}

  public async listAllStudentTimetables(studentId: string): Promise<StudyTimetableRecord[]> {
    return this.studyTimetableRepository.findByStudent(studentId);
  }

  public async getTimetableById(
    id: string,
    studentId: string,
  ): Promise<StudyTimetableRecord> {
    const record = await this.studyTimetableRepository.findById(id);

    if (!record || record.deletedAt) {
      throw new NotFoundError('TIMETABLE_NOT_FOUND');
    }

    if (record.studentId !== studentId) {
      throw new NotFoundError('TIMETABLE_NOT_FOUND');
    }

    return record;
  }

  public async createTimetable(
    studentId: string,
    input: Omit<CreateStudyTimetableInput, 'studentId'>,
  ): Promise<StudyTimetableRecord> {
    return this.studyTimetableRepository.create({
      ...input,
      studentId,
    });
  }

  public async updateTimetable(
    id: string,
    studentId: string,
    input: UpdateStudyTimetableInput,
  ): Promise<StudyTimetableRecord> {
    await this.getTimetableById(id, studentId);

    const updated = await this.studyTimetableRepository.update(id, input);

    if (!updated) {
      throw new NotFoundError('TIMETABLE_NOT_FOUND');
    }

    return updated;
  }

  public async deleteTimetable(id: string, studentId: string): Promise<void> {
    await this.getTimetableById(id, studentId);

    const deleted = await this.studyTimetableRepository.softDelete(id);

    if (!deleted) {
      throw new NotFoundError('TIMETABLE_NOT_FOUND');
    }
  }
  public async getTimetableHistory(
  studentId: string,
  fromDate?: string,
  toDate?: string,
): Promise<StudyTimetableRecord[]> {
  return this.studyTimetableRepository.findByStudentWithDateFilter(studentId, fromDate, toDate);
}
}