import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { StudySessionRecord } from '../../repositories/types/studySession.repository.types';

export class SessionLibraryData {
  @IsString() libraryId!: string;
  @IsString() libraryName!: string;
  @IsOptional() @IsString() seatId?: string;
  @IsOptional() @IsString() slotName?: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() status?: string;

  constructor(params?: {
    libraryId: string;
    libraryName: string;
    seatId?: string;
    slotName?: string;
    date?: string;
    status?: string;
  }) {
    if (!params) return;
    this.libraryId = params.libraryId;
    this.libraryName = params.libraryName;
    this.seatId = params.seatId;
    this.slotName = params.slotName;
    this.date = params.date;
    this.status = params.status;
  }
}

export class StudySessionData {
  @IsString() id!: string;
  @IsString() studentId!: string;
  @IsOptional() @IsString() libraryId?: string | null;
  @IsOptional() @IsString() bookingId?: string | null;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsNumber() durationMinutes!: number;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsNumber() revisionReminderDays?: number | null;
  @IsOptional() @IsDate() revisionReminderDate?: Date | null;
  @IsOptional()
  @ValidateNested()
  @Type(() => SessionLibraryData)
  library?: SessionLibraryData | null;
  @IsDate() createdAt!: Date;
  @IsDate() updatedAt!: Date;
  @IsNumber() studyDuration!: number;
  constructor(params?: StudySessionRecord, library?: SessionLibraryData | null) {
    if (!params) return;
    this.id = params.id;
    this.studentId = params.studentId;
    this.libraryId = params.libraryId;
    this.startTime = params.startTime;
    this.endTime = params.endTime;
    this.studyDuration = params.studyDuration;
    this.durationMinutes = params.durationMinutes;
    this.notes = params.notes;
    this.revisionReminderDays = params.revisionReminderDays;
    this.revisionReminderDate = params.revisionReminderDate;
    this.library = library || null;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }
}

export class StudySessionApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => StudySessionData)
  data!: StudySessionData;

  constructor(data?: StudySessionData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class StudySessionListPayloadData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudySessionData)
  sessions!: StudySessionData[];

  @IsNumber() total!: number;

  constructor(sessions?: StudySessionData[], total?: number) {
    if (!sessions || typeof total !== 'number') return;
    this.sessions = sessions;
    this.total = total;
  }
}

export class StudySessionListApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => StudySessionListPayloadData)
  data!: StudySessionListPayloadData;

  constructor(data?: StudySessionListPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class StudySessionStatsData {
  @IsNumber() totalSessions!: number;
  @IsNumber() totalMinutes!: number;
  @IsString() totalTimeFormatted!: string;
  @IsNumber() dayStreak!: number;

  constructor(params?: {
    totalSessions: number;
    totalMinutes: number;
    dayStreak: number;
  }) {
    if (!params) return;
    this.totalSessions = params.totalSessions;
    this.totalMinutes = params.totalMinutes;
    this.totalTimeFormatted = this.formatMinutes(params.totalMinutes);
    this.dayStreak = params.dayStreak;
  }

  private formatMinutes(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  }
}

export class StudySessionStatsApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => StudySessionStatsData)
  data!: StudySessionStatsData;

  constructor(data?: StudySessionStatsData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}