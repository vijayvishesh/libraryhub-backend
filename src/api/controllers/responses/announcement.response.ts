import { Type } from 'class-transformer';
import { IsArray, IsDate, IsNumber, IsString, ValidateNested } from 'class-validator';
import { AnnouncementRecord } from '../../repositories/types/announcement.repository.types';

export class AnnouncementData {
  @IsString() id!: string;
  @IsString() libraryId!: string;
  @IsString() title!: string;
  @IsString() message!: string;
  @IsString() target!: string;
  @IsNumber() sentCount!: number;
  @IsDate() createdAt!: Date;

  constructor(params?: AnnouncementRecord) {
    if (!params) return;
    this.id = params.id;
    this.libraryId = params.libraryId;
    this.title = params.title;
    this.message = params.message;
    this.target = params.target;
    this.sentCount = params.sentCount;
    this.createdAt = params.createdAt;
  }
}

export class AnnouncementApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => AnnouncementData)
  data!: AnnouncementData;

  constructor(data?: AnnouncementData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
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
    if (!announcements || typeof total !== 'number') return;
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
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}