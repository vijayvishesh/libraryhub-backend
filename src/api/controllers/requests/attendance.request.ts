import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CheckInRequest {
  @IsString()
  @IsNotEmpty()
  libraryId!: string;
}

export class StudentAttendanceHistoryQuery {
  @IsOptional()
  @IsString()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  @IsDateString()
  toDate?: string;
}

export class OwnerAttendanceHistoryQuery {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  @IsIn(['checked_in', 'checked_out', 'on_break'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}