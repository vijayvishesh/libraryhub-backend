import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateStudySessionRequest {
  @IsString()
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:mm format e.g. 09:00' })
  startTime!: string;

  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:mm format e.g. 11:00' })
  endTime!: string;
    @IsInt()
  @Min(1)
  studyDuration!: number; // in minutes, required, sent by user

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  revisionReminderDays?: number;

  @IsOptional()
  @IsString()
  libraryId?: string;

  // @IsOptional()
  // @IsString()
  // bookingId?: string;
}

export class UpdateStudySessionRequest {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  revisionReminderDays?: number;
}
export class StudySessionHistoryQuery {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'toDate must be YYYY-MM-DD' })
  toDate?: string;
}