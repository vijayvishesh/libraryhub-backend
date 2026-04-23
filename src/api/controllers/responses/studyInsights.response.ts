import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class WeekDayData {
  @IsString() day!: string;       // Mon, Tue, Wed...
  @IsNumber() hours!: number;     // 5.2, 7.2...

  constructor(params?: { day: string; hours: number }) {
    if (!params) return;
    this.day = params.day;
    this.hours = params.hours;
  }
}

export class RecentSessionData {
  @IsString() id!: string;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsNumber() studyDuration!: number;
  @IsNumber() durationMinutes!: number;
  @IsOptional() @IsString() notes?: string | null;
  @IsString() date!: string;

  constructor(params?: {
    id: string;
    startTime: string;
    endTime: string;
    studyDuration: number;
    durationMinutes: number;
    notes: string | null;
    date: string;
  }) {
    if (!params) return;
    this.id = params.id;
    this.startTime = params.startTime;
    this.endTime = params.endTime;
    this.studyDuration = params.studyDuration;
    this.durationMinutes = params.durationMinutes;
    this.notes = params.notes;
    this.date = params.date;
  }
}

export class StudyInsightsData {
  @IsString() todayHours!: string;         // e.g. "2h 30m"
  @IsNumber() todayMinutes!: number;
  @IsNumber() dayStreak!: number;
  @IsString() thisWeekHours!: string;      // e.g. "39.6h"
  @IsNumber() thisWeekMinutes!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeekDayData)
  weekGraph!: WeekDayData[];              // Mon-Sun with daily hours

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecentSessionData)
  recentSessions!: RecentSessionData[];   // last 5 sessions

  constructor(params?: {
    todayMinutes: number;
    dayStreak: number;
    thisWeekMinutes: number;
    weekGraph: { day: string; hours: number }[];
    recentSessions: {
      id: string;
      startTime: string;
      endTime: string;
      studyDuration: number;
      durationMinutes: number;
      notes: string | null;
      date: string;
    }[];
  }) {
    if (!params) return;
    this.todayMinutes = params.todayMinutes;
    this.todayHours = this.formatMinutes(params.todayMinutes);
    this.dayStreak = params.dayStreak;
    this.thisWeekMinutes = params.thisWeekMinutes;
    this.thisWeekHours = this.formatMinutes(params.thisWeekMinutes);
    this.weekGraph = params.weekGraph.map(g => new WeekDayData(g));
    this.recentSessions = params.recentSessions.map(s => new RecentSessionData(s));
  }

  private formatMinutes(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  }
}

export class StudyInsightsApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => StudyInsightsData)
  data!: StudyInsightsData;

  constructor(data?: StudyInsightsData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}