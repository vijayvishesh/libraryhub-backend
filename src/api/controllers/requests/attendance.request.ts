import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CheckInRequest {
  @IsString()
  @IsNotEmpty()
  libraryId!: string;
}

export class StudentAttendanceHistoryQuery {
@IsOptional()
@Matches(/^\d{4}-\d{2}-\d{2}$/)
fromDate?: string;

@IsOptional()
@Matches(/^\d{4}-\d{2}-\d{2}$/)
toDate?: string;
}

export class OwnerAttendanceHistoryQuery {
@IsOptional()
@Matches(/^\d{4}-\d{2}-\d{2}$/)
fromDate?: string;

@IsOptional()
@Matches(/^\d{4}-\d{2}-\d{2}$/)
toDate?: string;

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