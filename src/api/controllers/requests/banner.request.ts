import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { BannerDurationUnit } from '../../models/banner.model';

const VALID_DURATION_UNITS: BannerDurationUnit[] = ['days', 'months', 'years'];

export class CreateBannerRequest {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  details!: string;

  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

  @IsOptional()
  @IsString()
  redirectUrl?: string;

  @IsString()
  @IsNotEmpty()
  sponsorName!: string;

  @IsDateString()
  startDate!: string; // YYYY-MM-DD

  @IsInt()
  @Min(1)
  durationValue!: number;

  @IsString()
  @IsIn(VALID_DURATION_UNITS)
  durationUnit!: BannerDurationUnit;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBannerRequest {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  details?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  redirectUrl?: string;

  @IsOptional()
  @IsString()
  sponsorName?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationValue?: number;

  @IsOptional()
  @IsString()
  @IsIn(VALID_DURATION_UNITS)
  durationUnit?: BannerDurationUnit;

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}