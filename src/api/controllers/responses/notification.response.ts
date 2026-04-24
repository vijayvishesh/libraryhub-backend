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
import { NotificationRecord } from '../../repositories/types/notification.repository.types';

export class NotificationData {
  @IsString() id!: string;
  @IsString() studentId!: string;
  @IsString() title!: string;
  @IsString() message!: string;
  @IsString() type!: string;
  @IsOptional() @IsString() referenceId?: string | null;
  @IsBoolean() isRead!: boolean;
  @IsDate() createdAt!: Date;

  constructor(params?: NotificationRecord) {
    if (!params) return;
    this.id = params.id;
    this.studentId = params.studentId;
    this.title = params.title;
    this.message = params.message;
    this.type = params.type;
    this.referenceId = params.referenceId;
    this.isRead = params.isRead;
    this.createdAt = params.createdAt;
  }
}

export class NotificationApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => NotificationData)
  data!: NotificationData;

  constructor(data?: NotificationData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class NotificationListPayloadData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationData)
  notifications!: NotificationData[];

  @IsNumber() total!: number;
  @IsNumber() unreadCount!: number;

  constructor(notifications?: NotificationData[], total?: number, unreadCount?: number) {
    if (!notifications || typeof total !== 'number' || typeof unreadCount !== 'number') return;
    this.notifications = notifications;
    this.total = total;
    this.unreadCount = unreadCount;
  }
}

export class NotificationListApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => NotificationListPayloadData)
  data!: NotificationListPayloadData;

  constructor(data?: NotificationListPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class UnreadCountData {
  @IsNumber() unreadCount!: number;

  constructor(unreadCount?: number) {
    if (typeof unreadCount !== 'number') return;
    this.unreadCount = unreadCount;
  }
}

export class UnreadCountApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => UnreadCountData)
  data!: UnreadCountData;

  constructor(data?: UnreadCountData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}