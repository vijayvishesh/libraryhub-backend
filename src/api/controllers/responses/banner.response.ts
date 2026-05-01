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

  @IsNumber() total!: number;

  constructor(banners?: BannerData[], total?: number) {
    if (!banners || typeof total !== 'number') return;
    this.banners = banners;
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