import { Service } from 'typedi';
import { StudyTimetableRepository } from '../repositories/studyTimetable.repository';
import {
  CreateStudyTimetableInput,
  StudyTimetableRecord,
  UpdateStudyTimetableInput,
} from '../repositories/types/studyTimetable.repository.types';
// import { NotFoundError } from '../errors/notFound.error';
// import { ConflictError } from '../errors/conflict.error';

@Service()
export class StudyTimetableService {
  constructor(
    private readonly studyTimetableRepository: StudyTimetableRepository,
  ) {}

  // ─── List ───────────────────────────────────────────────────────────────────

  async listTimetables(
    studentId: string,
  ): Promise<StudyTimetableRecord[]> {
    return this.studyTimetableRepository.findByStudentAndLibrary(studentId);
  }

  async listAllStudentTimetables(studentId: string): Promise<StudyTimetableRecord[]> {
    return this.studyTimetableRepository.findByStudent(studentId);
  }

  // ─── Get One ────────────────────────────────────────────────────────────────

  async getTimetableById(
    id: string,
    studentId: string,
  ): Promise<StudyTimetableRecord> {
    const record = await this.studyTimetableRepository.findById(id);

    if (!record || record.deletedAt) {
    //   throw new NotFoundError('Study timetable not found');
    }

    if (record.studentId !== studentId) {
    //   throw new NotFoundError('Study timetable not found');
    }

    return record;
  }

  // ─── Create ─────────────────────────────────────────────────────────────────

  async createTimetable(
    studentId: string,
    input: Omit<CreateStudyTimetableInput, 'studentId'>,
  ): Promise<StudyTimetableRecord> {
    return this.studyTimetableRepository.create({
      ...input,
      studentId,
    });
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  async updateTimetable(
    id: string,
    studentId: string,
    input: UpdateStudyTimetableInput,
  ): Promise<StudyTimetableRecord> {
    // Ownership check
    await this.getTimetableById(id, studentId);

    const updated = await this.studyTimetableRepository.update(id, input);

    if (!updated) {
    //   throw new NotFoundError('Study timetable not found');
    }

    return updated;
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────

  async deleteTimetable(id: string, studentId: string): Promise<void> {
    // Ownership check
    await this.getTimetableById(id, studentId);

    const deleted = await this.studyTimetableRepository.softDelete(id);

    if (!deleted) {
    //   throw new NotFoundError('Study timetable not found');
    }
  }
}