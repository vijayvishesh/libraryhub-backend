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

export class OwnerNotificationData {
  @IsString() id!: string;
  @IsString() title!: string;
  @IsString() message!: string;
  @IsString() type!: string;
  @IsOptional() @IsString() referenceId?: string | null;
  @IsBoolean() isRead!: boolean;
  @IsDate() createdAt!: Date;

  constructor(params?: NotificationRecord) {
    if (!params) return;
    this.id = params.id;
    this.title = params.title;
    this.message = params.message;
    this.type = params.type;
    this.referenceId = params.referenceId;
    this.isRead = params.isRead;
    this.createdAt = params.createdAt;
  }
}

export class OwnerNotificationListPayload {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OwnerNotificationData)
  notifications!: OwnerNotificationData[];

  @IsNumber() total!: number;
  @IsNumber() unreadCount!: number;

  constructor(
    notifications?: OwnerNotificationData[],
    total?: number,
    unreadCount?: number,
  ) {
    if (!notifications || total === undefined || unreadCount === undefined) return;
    this.notifications = notifications;
    this.total = total;
    this.unreadCount = unreadCount;
  }
}

export class OwnerNotificationListApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => OwnerNotificationListPayload)
  data!: OwnerNotificationListPayload;

  constructor(data?: OwnerNotificationListPayload, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class OwnerNotificationApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => OwnerNotificationData)
  data!: OwnerNotificationData;

  constructor(data?: OwnerNotificationData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class OwnerUnreadCountData {
  @IsNumber() unreadCount!: number;

  constructor(unreadCount?: number) {
    if (typeof unreadCount !== 'number') return;
    this.unreadCount = unreadCount;
  }
}

export class OwnerUnreadCountApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => OwnerUnreadCountData)
  data!: OwnerUnreadCountData;

  constructor(data?: OwnerUnreadCountData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}