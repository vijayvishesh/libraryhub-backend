import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { BannerRecord } from '../../repositories/types/banner.repository.types';
import { AnnouncementRecord } from '../../repositories/types/announcement.repository.types';

export class BannerData {
  @IsString() id!: string;
  @IsString() title!: string;
  @IsString() details!: string;
  @IsString() imageUrl!: string;
  @IsOptional() @IsString() redirectUrl?: string | null;
  @IsString() sponsorName!: string;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
  @IsNumber() durationValue!: number;
  @IsString() durationUnit!: string;
  @IsNumber() priority!: number;
  @IsBoolean() isActive!: boolean;
  @IsDate() createdAt!: Date;
  @IsDate() updatedAt!: Date;

  constructor(params?: BannerRecord) {
    if (!params) return;
    this.id = params.id;
    this.title = params.title;
    this.details = params.details;
    this.imageUrl = params.imageUrl;
    this.redirectUrl = params.redirectUrl;
    this.sponsorName = params.sponsorName;
    this.startDate = params.startDate;
    this.endDate = params.endDate;
    this.durationValue = params.durationValue;
    this.durationUnit = params.durationUnit;
    this.priority = params.priority;
    this.isActive = params.isActive;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }
}

export class AnnouncementSummaryData {
  @IsString() id!: string;
  @IsString() libraryId!: string;
  @IsString() title!: string;
  @IsString() message!: string;
  @IsString() target!: string;
  @IsBoolean() isActive!: boolean;
  @IsOptional() @IsString() expiresAt?: string | null;
  @IsString() createdAt!: string;

  constructor(r?: AnnouncementRecord) {
    if (!r) return;
    this.id = r.id;
    this.libraryId = r.libraryId;
    this.title = r.title;
    this.message = r.message;
    this.target = r.target;
    this.isActive = r.isActive;
    this.expiresAt = r.expiresAt?.toISOString() ?? null;
    this.createdAt = r.createdAt.toISOString();
  }
}

export class BannerApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => BannerData)
  data!: BannerData;

  constructor(data?: BannerData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class BannerListPayloadData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BannerData)
  banners!: BannerData[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnnouncementSummaryData)
  announcements!: AnnouncementSummaryData[];

  @IsNumber() total!: number;

  constructor(
    banners?: BannerData[],
    announcements?: AnnouncementSummaryData[],
    total?: number,
  ) {
    if (!banners || !announcements || typeof total !== 'number') return;
    this.banners = banners;
    this.announcements = announcements;
    this.total = total;
  }
}

export class BannerListApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => BannerListPayloadData)
  data!: BannerListPayloadData;

  constructor(data?: BannerListPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}
