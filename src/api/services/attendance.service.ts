import { BadRequestError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { MemberRepository } from '../repositories/member.repository';
import { LibraryRepository } from '../repositories/library.repository';
import { AttendanceRecord } from '../repositories/types/attendance.repository.types';

@Service()
export class AttendanceService {
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly memberRepository: MemberRepository,
    private readonly libraryRepository: LibraryRepository,
  ) {}

  public async checkIn(
    studentId: string,
    libraryId: string,
  ): Promise<AttendanceRecord> {
    // Check active membership
    const member = await this.memberRepository.findMemberByStudentIdAndLibrary(
      studentId,
      libraryId,
    );

    if (!member || member.status !== 'active') {
      throw new BadRequestError('NO_ACTIVE_MEMBERSHIP');
    }

    // const today = new Date().toISOString().split('T')[0];

    // Check already checked in today


    return this.attendanceRepository.create({
      studentId,
      libraryId,
      membershipId: member.id,
      seatId: member.seatId,
      studentName: member.fullName,
      // date: today,
      checkInTime: new Date(),
    });
  }

  public async checkOut(id: string, studentId: string): Promise<AttendanceRecord> {
    const record = await this.getAttendanceById(id, studentId);

    if (record.status === 'checked_out') {
      throw new BadRequestError('ALREADY_CHECKED_OUT');
    }

    const updated = await this.attendanceRepository.update(id, {
      checkOutTime: new Date(),
      status: 'checked_out',
    });

    if (!updated) throw new NotFoundError('ATTENDANCE_NOT_FOUND');
    return updated;
  }

  public async setOnBreak(id: string, studentId: string): Promise<AttendanceRecord> {
    const record = await this.getAttendanceById(id, studentId);

    if (record.status !== 'checked_in') {
      throw new BadRequestError('NOT_CHECKED_IN');
    }

    const updated = await this.attendanceRepository.update(id, { status: 'on_break' });
    if (!updated) throw new NotFoundError('ATTENDANCE_NOT_FOUND');
    return updated;
  }

  public async resumeFromBreak(id: string, studentId: string): Promise<AttendanceRecord> {
    const record = await this.getAttendanceById(id, studentId);

    if (record.status !== 'on_break') {
      throw new BadRequestError('NOT_ON_BREAK');
    }

    const updated = await this.attendanceRepository.update(id, { status: 'checked_in' });
    if (!updated) throw new NotFoundError('ATTENDANCE_NOT_FOUND');
    return updated;
  }

  public async getTodayAttendanceForOwner(ownerId: string): Promise<{
    records: AttendanceRecord[];
    present: number;
    onBreak: number;
    absent: number;
  }> {
    // Get owner's library
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
    if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');

    const today = new Date().toISOString().split('T')[0];

    // Get today's attendance
    const records = await this.attendanceRepository.findTodayByLibrary(
      library.id,
      today,
    );

    // Get all active members for absent count
    const allMembers = await this.memberRepository.findAllMembersByLibrary(library.id);
    const activeMembers = allMembers.filter(m => m.status === 'active');

    const checkedInStudentIds = new Set(records.map(r => r.studentId));
    const present = records.filter(r => r.status === 'checked_in').length;
    const onBreak = records.filter(r => r.status === 'on_break').length;
    const absent = activeMembers.filter(m => m.studentId && !checkedInStudentIds.has(m.studentId)).length;

    return { records, present, onBreak, absent };
  }

  private async getAttendanceById(
    id: string,
    studentId: string,
  ): Promise<AttendanceRecord> {
    const record = await this.attendanceRepository.findById(id);
    if (!record) throw new NotFoundError('ATTENDANCE_NOT_FOUND');
    if (record.studentId !== studentId) throw new NotFoundError('ATTENDANCE_NOT_FOUND');
    return record;
  }

  public async getStudentAttendanceHistory(
  studentId: string,
  fromDate?: string,
  toDate?: string,
): Promise<{ records: AttendanceRecord[]; total: number }> {
  const records = await this.attendanceRepository.findByStudentWithFilters(
    studentId,
    fromDate,
    toDate,
  );
  return { records, total: records.length };
}

public async getOwnerAttendanceHistory(
  ownerId: string,
  query: {
    fromDate?: string;
    toDate?: string;
    date?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  },
): Promise<{ records: AttendanceRecord[]; total: number; page: number; limit: number }> {
  const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
  if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const result = await this.attendanceRepository.findByLibraryWithFilters(
    library.id,
    // query.date,
    query.fromDate,
    query.toDate,
    query.status,
    query.search,
    page,
    limit,
  );

  return { ...result, page, limit };
}
}