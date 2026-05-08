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

    const today = new Date().toISOString().split('T')[0];
    
    return this.attendanceRepository.create({
      studentId,
      libraryId,
      membershipId: member.id,
      seatId: member.seatId,
      studentName: member.fullName,
      date: today,
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

public async getStudentAttendanceById(
  studentId: string,
  query: {
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  },
): Promise<{
  records: AttendanceRecord[];
  total: number;
  page: number;
  limit: number;
  stats: {
    weeklyPresentDays: number;
    weeklyWorkingDays: number;
    weeklyPercentage: number;
    monthlyPresentDays: number;
    monthlyWorkingDays: number;
    monthlyPercentage: number;
    currentStreak: number;
    currentDate: string;
  };
}> {
  const page  = query.page  ?? 1;
  const limit = query.limit ?? 20;

  const today     = new Date();
  const todayStr  = today.toISOString().split('T')[0]; // 'YYYY-MM-DD'

  // ── 1. Determine history date range ─────────────────────────────────────
  // If no dates given → full current month
  const historyFrom = query.fromDate
    ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const historyTo   = query.toDate ?? todayStr;

  // ── 2. Fetch paginated records for history list ──────────────────────────
  const allFiltered = await this.attendanceRepository.findByStudentWithFilters(
    studentId,
    historyFrom,
    historyTo,
  );

  const total        = allFiltered.length;
  const paginatedRec = allFiltered.slice((page - 1) * limit, page * limit);

  // ── 3. Weekly stats (Mon–today of current week) ──────────────────────────
  const dayOfWeek      = today.getDay(); // 0=Sun,1=Mon,...,6=Sat
  // Monday of current week
  const diffToMonday   = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday         = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const weekFrom = monday.toISOString().split('T')[0];
  const weekTo   = todayStr;

  // Count Mon–today working days (Mon–Sat = 6 days, exclude Sun)
  let weeklyWorkingDays = 0;
  const cur = new Date(monday);
  while (cur <= today) {
    if (cur.getDay() !== 0) weeklyWorkingDays++; // exclude Sunday
    cur.setDate(cur.getDate() + 1);
  }

  const weekRecords = await this.attendanceRepository.findByStudentWithFilters(
    studentId,
    weekFrom,
    weekTo,
  );
  // Unique days present this week
  const weekPresentDays = new Set(weekRecords.map(r => r.date)).size;
  const weeklyPercentage =
    weeklyWorkingDays > 0
      ? Math.round((weekPresentDays / weeklyWorkingDays) * 100)
      : 0;

  // ── 4. Monthly stats (1st of month → today) ──────────────────────────────
  const monthFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const monthTo   = todayStr;

  // Count working days Mon–Sat from 1st to today
  let monthlyWorkingDays = 0;
  const mCur = new Date(monthFrom);
  while (mCur <= today) {
    if (mCur.getDay() !== 0) monthlyWorkingDays++;
    mCur.setDate(mCur.getDate() + 1);
  }

  const monthRecords = await this.attendanceRepository.findByStudentWithFilters(
    studentId,
    monthFrom,
    monthTo,
  );
  const monthPresentDays = new Set(monthRecords.map(r => r.date)).size;
  const monthlyPercentage =
    monthlyWorkingDays > 0
      ? Math.round((monthPresentDays / monthlyWorkingDays) * 100)
      : 0;

  // ── 5. Current streak (consecutive days present going back from today) ───
  // Fetch last 90 days to calculate streak
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(today.getDate() - 90);
  const streakFrom = ninetyDaysAgo.toISOString().split('T')[0];

  const streakRecords = await this.attendanceRepository.findByStudentWithFilters(
    studentId,
    streakFrom,
    todayStr,
  );

  // Build a Set of all present dates
  const presentDatesSet = new Set(streakRecords.map(r => r.date));

  // Walk backwards from today counting consecutive present days
  let currentStreak   = 0;
  const streakCur     = new Date(today);

  while (true) {
    const dateStr = streakCur.toISOString().split('T')[0];
    // Skip Sundays (non-working day — don't break streak)
    if (streakCur.getDay() === 0) {
      streakCur.setDate(streakCur.getDate() - 1);
      continue;
    }
    if (presentDatesSet.has(dateStr)) {
      currentStreak++;
      streakCur.setDate(streakCur.getDate() - 1);
    } else {
      // If today itself is absent, streak is 0 — don't penalise past days
      break;
    }
  }

  return {
    records: paginatedRec,
    total,
    page,
    limit,
    stats: {
      weeklyPresentDays:  weekPresentDays,
      weeklyWorkingDays,
      weeklyPercentage,
      monthlyPresentDays: monthPresentDays,
      monthlyWorkingDays,
      monthlyPercentage,
      currentStreak,
      currentDate: todayStr,
    },
  };
}
}