import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDate, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { StudyTimetableRecord } from '../../repositories/types/studyTimetable.repository.types';
import { TimetableDay } from '../../models/studyTimetable.model';

export class ReminderData {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsNumber()
  minutesBefore?: number;

  constructor(params?: { enabled: boolean; minutesBefore?: number }) {
    if (!params) return;
    this.enabled = params.enabled;
    this.minutesBefore = params.minutesBefore;
  }
}

export class SubjectData {
  @IsString()
  subjectName!: string;

  @IsArray()
  @IsString({ each: true })
  days!: TimetableDay[];

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsString()
  color!: string;

  @ValidateNested()
  @Type(() => ReminderData)
  reminder!: ReminderData;

  constructor(params?: {
    subjectName: string;
    days: TimetableDay[];
    startTime: string;
    endTime: string;
    color: string;
    reminder: { enabled: boolean; minutesBefore?: number };
  }) {
    if (!params) return;
    this.subjectName = params.subjectName;
    this.days = params.days;
    this.startTime = params.startTime;
    this.endTime = params.endTime;
    this.color = params.color;
    this.reminder = new ReminderData(params.reminder);
  }
}

export class StudyTimetableData {
  @IsString()
  id!: string;

  @IsString()
  studentId!: string;

  @IsString()
  title!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectData)
  subjects!: SubjectData[];

  @IsBoolean()
  isActive!: boolean;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;

  constructor(params?: StudyTimetableRecord) {
    if (!params) return;
    this.id = params.id;
    this.studentId = params.studentId;
    this.title = params.title;
    this.subjects = params.subjects.map(s => new SubjectData(s));
    this.isActive = params.isActive;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }
}

export class StudyTimetableApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => StudyTimetableData)
  data!: StudyTimetableData;

  constructor(data?: StudyTimetableData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class StudyTimetableListPayloadData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudyTimetableData)
  timetables!: StudyTimetableData[];

  @IsNumber()
  total!: number;

  constructor(timetables?: StudyTimetableData[], total?: number) {
    if (!timetables || typeof total !== 'number') return;
    this.timetables = timetables;
    this.total = total;
  }
}

export class StudyTimetableListApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => StudyTimetableListPayloadData)
  data!: StudyTimetableListPayloadData;

  constructor(data?: StudyTimetableListPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}