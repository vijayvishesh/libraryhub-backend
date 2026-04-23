import { NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { LibraryRepository } from '../repositories/library.repository';
// import { BookingRepository } from '../repositories/booking.repository';
import { StudySessionRepository } from '../repositories/studySession.repository';
import { StudySessionRecord } from '../repositories/types/studySession.repository.types';
import { CreateStudySessionRequest, UpdateStudySessionRequest } from '../controllers/requests/studySession.request';
import { SessionLibraryData } from '../controllers/responses/studySession.response';

@Service()
export class StudySessionService {
  constructor(
    private readonly studySessionRepository: StudySessionRepository,
    private readonly libraryRepository: LibraryRepository,
    // private readonly bookingRepository: BookingRepository,
  ) {}

  public async createSession(
    studentId: string,
    input: CreateStudySessionRequest,
  ): Promise<StudySessionRecord> {
    const durationMinutes = this.calculateDuration(input.startTime, input.endTime);
    const revisionReminderDate = input.revisionReminderDays
      ? new Date(Date.now() + input.revisionReminderDays * 24 * 60 * 60 * 1000)
      : null;

    return this.studySessionRepository.create({
      studentId,
      libraryId: input.libraryId || null,
      studyDuration: input.studyDuration,
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes,
      notes: input.notes || null,
      revisionReminderDays: input.revisionReminderDays || null,
      revisionReminderDate,
    });
  }

  public async listSessions(studentId: string): Promise<StudySessionRecord[]> {
    return this.studySessionRepository.findByStudent(studentId);
  }

  public async getSessionById(
    id: string,
    studentId: string,
  ): Promise<StudySessionRecord> {
    const record = await this.studySessionRepository.findById(id);
    if (!record || record.deletedAt) throw new NotFoundError('SESSION_NOT_FOUND');
    if (record.studentId !== studentId) throw new NotFoundError('SESSION_NOT_FOUND');
    return record;
  }

  public async updateSession(
    id: string,
    studentId: string,
    input: UpdateStudySessionRequest,
  ): Promise<StudySessionRecord> {
    await this.getSessionById(id, studentId);
    const updated = await this.studySessionRepository.update(id, {
      notes: input.notes,
      revisionReminderDays: input.revisionReminderDays,
      revisionReminderDate: input.revisionReminderDays
        ? new Date(Date.now() + input.revisionReminderDays * 24 * 60 * 60 * 1000)
        : null,
    });
    if (!updated) throw new NotFoundError('SESSION_NOT_FOUND');
    return updated;
  }

  public async deleteSession(id: string, studentId: string): Promise<void> {
    await this.getSessionById(id, studentId);
    await this.studySessionRepository.softDelete(id);
  }

  public async getStats(studentId: string): Promise<{
    totalSessions: number;
    totalMinutes: number;
    dayStreak: number;
  }> {
    const sessions = await this.studySessionRepository.findByStudent(studentId);
    const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const dayStreak = this.calculateDayStreak(sessions);
    return {
      totalSessions: sessions.length,
      totalMinutes,
      dayStreak,
    };
  }

  public async getLibraryDataForSession(
    session: StudySessionRecord,
  ): Promise<SessionLibraryData | null> {
    if (!session.libraryId) return null;

    const library = await this.libraryRepository.findLibraryById(session.libraryId);
    if (!library) return null;

    // if (session.bookingId) {
    //   const booking = await this.bookingRepository.findBookingById(session.bookingId);
    //   if (booking) {
    //     return new SessionLibraryData({
    //       libraryId: library.id,
    //       libraryName: library.name,
    //       seatId: booking.seatId,
    //       slotName: booking.slotName,
    //       date: booking.date,
    //       status: booking.status,
    //     });
    //   }
    // }

    return new SessionLibraryData({
      libraryId: library.id,
      libraryName: library.name,
    });
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;
    return Math.max(0, endTotal - startTotal);
  }

  private calculateDayStreak(sessions: StudySessionRecord[]): number {
    if (sessions.length === 0) return 0;
    const studyDays = new Set(
      sessions.map(s => new Date(s.createdAt).toISOString().split('T')[0]),
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      if (studyDays.has(dateStr)) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }
}