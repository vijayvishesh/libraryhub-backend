import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { SubscriptionPlanResult, LibrarySubscriptionResult, LibrarySubscriptionStatusResult } from '../../services/types/subscription.service.types';

export class SubscriptionPlanResponseData {
  @IsString()  id!: string;
  @IsString()  name!: string;
  @IsString()  description!: string;
  @IsNumber()  price!: number;
  @IsNumber()  durationDays!: number;
  @IsObject()  features!: Record<string, unknown>;
  @IsBoolean() isActive!: boolean;
  @IsNumber()  sortOrder!: number;

  constructor(plan?: SubscriptionPlanResult) {
    if (!plan) return;
    this.id          = plan.id;
    this.name        = plan.name;
    this.description = plan.description;
    this.price       = plan.price;
    this.durationDays= plan.durationDays;
    this.features    = plan.features as Record<string, unknown>;
    this.isActive    = plan.isActive;
    this.sortOrder   = plan.sortOrder;
  }
}

export class LibrarySubscriptionResponseData {
  @IsString()           id!: string;
  @IsString()           libraryId!: string;
  @IsString()           planId!: string;
  @IsString()           planName!: string;
  @IsObject()           features!: Record<string, unknown>;
  @IsString()           status!: string;
  @IsString()           activatedBy!: string;
  @IsString()           startDate!: string;
  @IsString()           endDate!: string;
  @IsNumber()           daysRemaining!: number;
  @IsNumber()           amount!: number;
  @IsOptional()
  @IsString()           paymentMethod?: string | null;
  @IsOptional()
  @IsString()           notes?: string | null;

  constructor(sub?: LibrarySubscriptionResult) {
    if (!sub) return;
    this.id               = sub.id;
    this.libraryId        = sub.libraryId;
    this.planId           = sub.planId;
    this.planName         = sub.planName;
    this.features         = sub.features as Record<string, unknown>;
    this.status           = sub.status;
    this.activatedBy      = sub.activatedBy;
    this.startDate        = sub.startDate;
    this.endDate          = sub.endDate;
    this.daysRemaining    = sub.daysRemaining;
    this.amount           = sub.amount;
    this.paymentMethod    = sub.paymentMethod;
    this.notes            = sub.notes;
  }
}

export class LibrarySubscriptionStatusResponseData {
  @IsBoolean() noPlan!: boolean;
  @IsOptional() @IsString() libraryId?: string;
  @IsOptional() @IsString() message?: string;
  @IsOptional() availablePlans?: SubscriptionPlanResponseData[];
  @IsOptional() subscription?: LibrarySubscriptionResponseData;

 constructor(result?: LibrarySubscriptionStatusResult) {
  if (!result) return;
  this.noPlan = result.noPlan;

  if (result.noPlan === true) {
    this.libraryId      = result.libraryId;
    this.message        = result.message;
    this.availablePlans = result.availablePlans.map(p => new SubscriptionPlanResponseData(p));
  } else {
    this.subscription = new LibrarySubscriptionResponseData(result.subscription);
  }
}
}

// ── API Response wrappers ────────────────────────────────────────────

export class SubscriptionPlanApiResponse {
  @IsNumber() responseCode!: number;
  @Type(() => SubscriptionPlanResponseData)
  data!: SubscriptionPlanResponseData;

  constructor(data?: SubscriptionPlanResponseData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class SubscriptionPlanListApiResponse {
  @IsNumber() responseCode!: number;
  data!: { plans: SubscriptionPlanResponseData[]; total: number };

  constructor(plans?: SubscriptionPlanResponseData[], responseCode = 200) {
    if (!plans || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = { plans, total: plans.length };
  }
}

export class LibrarySubscriptionStatusApiResponse {
  @IsNumber() responseCode!: number;
  @Type(() => LibrarySubscriptionStatusResponseData)
  data!: LibrarySubscriptionStatusResponseData;

  constructor(data?: LibrarySubscriptionStatusResponseData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class LibrarySubscriptionApiResponse {
  @IsNumber() responseCode!: number;
  @Type(() => LibrarySubscriptionResponseData)
  data!: LibrarySubscriptionResponseData;

  constructor(data?: LibrarySubscriptionResponseData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class LibrarySubscriptionListApiResponse {
  @IsNumber() responseCode!: number;
  data!: { subscriptions: LibrarySubscriptionResponseData[]; total: number; page: number; limit: number };

  constructor(
    subscriptions?: LibrarySubscriptionResponseData[],
    total?: number,
    page?: number,
    limit?: number,
    responseCode = 200,
  ) {
    if (!subscriptions || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = { subscriptions, total: total ?? 0, page: page ?? 1, limit: limit ?? 20 };
  }
}

export class BulkActivateApiResponse {
  @IsNumber() responseCode!: number;
  data!: { activated: number; message: string };

  constructor(activated?: number, responseCode = 200) {
    if (typeof activated !== 'number') return;
    this.responseCode = responseCode;
    this.data = { activated, message: `Successfully activated plan for ${activated} libraries` };
  }
}