import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AttendanceRecord } from '../../repositories/types/attendance.repository.types';

export class AttendanceData {
  @IsString() id!: string;
  @IsString() studentId!: string;
  @IsString() libraryId!: string;
  @IsString() membershipId!: string;
  @IsOptional() @IsString() seatId?: string | null;
  @IsString() studentName!: string;
  @IsString() date!: string;
  @IsDate() checkInTime!: Date;
  @IsOptional() @IsDate() checkOutTime?: Date | null;
  @IsString() status!: string;
  @IsDate() createdAt!: Date;

  constructor(params?: AttendanceRecord) {
    if (!params) return;
    this.id = params.id;
    this.studentId = params.studentId;
    this.libraryId = params.libraryId;
    this.membershipId = params.membershipId;
    this.seatId = params.seatId;
    this.studentName = params.studentName;
    this.date = params.date;
    this.checkInTime = params.checkInTime;
    this.checkOutTime = params.checkOutTime;
    this.status = params.status;
    this.createdAt = params.createdAt;
  }
}

export class AttendanceApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => AttendanceData)
  data!: AttendanceData;

  constructor(data?: AttendanceData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class AttendanceSummaryData {
  @IsNumber() present!: number;
  @IsNumber() onBreak!: number;
  @IsNumber() absent!: number;

  constructor(params?: { present: number; onBreak: number; absent: number }) {
    if (!params) return;
    this.present = params.present;
    this.onBreak = params.onBreak;
    this.absent = params.absent;
  }
}

export class TodayAttendanceData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceData)
  records!: AttendanceData[];

  @ValidateNested()
  @Type(() => AttendanceSummaryData)
  summary!: AttendanceSummaryData;

  @IsNumber() total!: number;

  constructor(
    records?: AttendanceData[],
    summary?: AttendanceSummaryData,
    total?: number,
  ) {
    if (!records || !summary || typeof total !== 'number') return;
    this.records = records;
    this.summary = summary;
    this.total = total;
  }
}

export class TodayAttendanceApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => TodayAttendanceData)
  data!: TodayAttendanceData;

  constructor(data?: TodayAttendanceData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}