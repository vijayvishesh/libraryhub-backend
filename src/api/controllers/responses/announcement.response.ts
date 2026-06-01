import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AnnouncementRecord } from '../../repositories/types/announcement.repository.types';

export class AnnouncementData {
  @IsString() id!: string;
  @IsString() libraryId!: string;
  @IsString() title!: string;
  @IsString() message!: string;
  @IsString() target!: string;
  @IsNumber() sentCount!: number;
  @IsBoolean() isActive!: boolean;
  @IsOptional() @IsString() expiresAt?: string | null;
  @IsOptional() @IsString() expiryUnit?: string | null;
  @IsOptional() @IsNumber() expiryValue?: number | null;
  @IsString() createdAt!: string;
  @IsString() updatedAt!: string;
  @IsOptional() @IsArray() memberIds?: string[] | null;

  constructor(r?: AnnouncementRecord) {
    if (!r) {
      return;
    }
    this.id = r.id;
    this.libraryId = r.libraryId;
    this.title = r.title;
    this.message = r.message;
    this.target = r.target;
    this.sentCount = r.sentCount;
    this.isActive = r.isActive;
    this.memberIds = r.memberIds ?? null;
    this.expiresAt = r.expiresAt?.toISOString() ?? null;
    this.expiryUnit = r.expiryUnit;
    this.expiryValue = r.expiryValue;
    this.createdAt = r.createdAt.toISOString();
    this.updatedAt = r.updatedAt.toISOString();
  }
}

export class AnnouncementApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested() @Type(() => AnnouncementData) data!: AnnouncementData;

  constructor(data?: AnnouncementData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class AnnouncementListPayloadData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnnouncementData)
  announcements!: AnnouncementData[];
  @IsNumber() total!: number;

  constructor(announcements?: AnnouncementData[], total?: number) {
    if (!announcements || typeof total !== 'number') {
      return;
    }
    this.announcements = announcements;
    this.total = total;
  }
}

export class AnnouncementListApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => AnnouncementListPayloadData)
  data!: AnnouncementListPayloadData;

  constructor(data?: AnnouncementListPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }
    this.responseCode = responseCode;
    this.data = data;
  }
}

// ── Target list response ──────────────────────────────────────────────────
export class AnnouncementTargetData {
  @IsString() value!: string;
  @IsString() label!: string;
  @IsString() group!: string;
  @IsString() description!: string;

  constructor(value: string, label: string, group: string, description: string) {
    this.value = value;
    this.label = label;
    this.group = group;
    this.description = description;
  }
}

export class AnnouncementTargetListApiResponse {
  @IsNumber() responseCode!: number;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnnouncementTargetData)
  data!: AnnouncementTargetData[];

  constructor(data?: AnnouncementTargetData[], responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }
    this.responseCode = responseCode;
    this.data = data;
  }
}
