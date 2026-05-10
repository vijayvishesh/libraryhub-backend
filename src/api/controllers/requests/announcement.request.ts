import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { AnnouncementTarget } from '../../models/announcement.model';

// All possible targets — slot-based ones filtered dynamically per library
export const ALL_ANNOUNCEMENT_TARGETS: AnnouncementTarget[] = [
  'all',
  'absent',
  'fee_due',
  'expired',
  'overdue',
  'fullday',
  'firsthalf',
  'secondhalf',
  'twentyfour',
  'halfday',
  'evening',
  'morning',
  'night',
  'custom',
];

export class AnnouncementExpiryRequest {
  // Option A — duration based
  @IsOptional()
  @IsString()
  @IsIn(['hours', 'days'])
  unit?: 'hours' | 'days';

  @IsOptional()
  @IsInt()
  @Min(1)
  value?: number;

  // Option B — absolute datetime
  @IsOptional()
  @IsString()
  expiresAt?: string; // ISO datetime string e.g. '2026-05-10T18:00:00Z'
}

export class CreateAnnouncementRequest {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsIn(ALL_ANNOUNCEMENT_TARGETS)
  target!: AnnouncementTarget;

  // isActive defaults to true on create
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Optional expiry — either duration OR absolute datetime
  @IsOptional()
  @ValidateNested()
  @Type(() => AnnouncementExpiryRequest)
  expiry?: AnnouncementExpiryRequest;
}

export class UpdateAnnouncementRequest {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  message?: string;

  @IsOptional()
  @IsString()
  @IsIn(ALL_ANNOUNCEMENT_TARGETS)
  target?: AnnouncementTarget;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnnouncementExpiryRequest)
  expiry?: AnnouncementExpiryRequest;
}

export class ToggleAnnouncementRequest {
  @IsBoolean()
  isActive!: boolean;
}