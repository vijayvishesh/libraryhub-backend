import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AnnouncementTarget } from '../../models/announcement.model';

const VALID_TARGETS: AnnouncementTarget[] = [
  'all',
  'fullday',
  'firsthalf',
  'secondhalf',
  'twentyfour',
  'overdue',
];

export class CreateAnnouncementRequest {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsIn(VALID_TARGETS)
  target!: AnnouncementTarget;
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
  @IsIn(['all', 'fullday', 'firsthalf', 'secondhalf', 'twentyfour', 'overdue'])
  target?: AnnouncementTarget;
}