import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class SubscriptionPlanFeaturesRequest {
  @IsInt() @Min(1)   maxMembers!: number;
  @IsBoolean()       seatMap!: boolean;
  @IsBoolean()       attendanceTracking!: boolean;
  @IsBoolean()       feeCollection!: boolean;
  @IsBoolean()       renewalManagement!: boolean;
  @IsBoolean()       reportAnalytics!: boolean;
  @IsBoolean()       multipleSlots!: boolean;
  @IsBoolean()       studentApp!: boolean;
  @IsBoolean()       pushNotifications!: boolean;
  @IsBoolean()       exportReports!: boolean;
  @IsBoolean()       customBranding!: boolean;
  @IsBoolean()       apiAccess!: boolean;
}

export class CreateSubscriptionPlanRequest {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() description!: string;

  @IsNumber() @Min(0)       price!: number;

  @IsInt() @IsIn([30, 90, 180, 365])
  durationDays!: number;

  @ValidateNested()
  @Type(() => SubscriptionPlanFeaturesRequest)
  @IsObject()
  features!: SubscriptionPlanFeaturesRequest;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

export class UpdateSubscriptionPlanRequest {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() @IsNotEmpty() description?: string;
  @IsOptional() @IsNumber() @Min(0)       price?: number;

  @IsOptional() @IsInt() @IsIn([30, 90, 180, 365])
  durationDays?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => SubscriptionPlanFeaturesRequest)
  @IsObject()
  features?: SubscriptionPlanFeaturesRequest;

  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class AdminActivateSubscriptionRequest {
  @IsString() @IsNotEmpty() libraryId!: string;
  @IsString() @IsNotEmpty() planId!: string;

  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  startDate?: string;

  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() paymentMethod?: string;
}

export class AdminActivateBulkSubscriptionRequest {
  @IsString() @IsNotEmpty() planId!: string;

  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  startDate?: string;

  @IsOptional() @IsString() notes?: string;
}

export class AdminUpdateSubscriptionRequest {
  @IsOptional()
  @IsString()
  @IsIn(['active', 'expired', 'cancelled', 'trial'])
  status?: 'active' | 'expired' | 'cancelled' | 'trial';

  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  endDate?: string;

  @IsOptional() @IsString() notes?: string;
}

export class AdminListSubscriptionsQueryRequest {
  @IsOptional() @IsString() libraryId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'expired', 'cancelled', 'trial'])
  status?: 'active' | 'expired' | 'cancelled' | 'trial';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}