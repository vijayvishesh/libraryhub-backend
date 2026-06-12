import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
export class AppUpdateStatusData {
  @IsBoolean() requiresUpdate!: boolean;
  @IsBoolean() forceUpdate!:    boolean;
  @IsString()  latestVersion!:  string;
  @IsString()  currentVersion!: string;
  @IsString()  message!:        string;

  constructor(params?: {
    requiresUpdate: boolean;
    forceUpdate:    boolean;
    latestVersion:  string;
    currentVersion: string;
    message:        string;
  }) {
    if (!params) return;
    this.requiresUpdate = params.requiresUpdate;
    this.forceUpdate    = params.forceUpdate;
    this.latestVersion  = params.latestVersion;
    this.currentVersion = params.currentVersion;
    this.message        = params.message;
  }
}
export class OwnerDashboardLibraryData {
  @IsString()
  name!: string;

  @IsString()
  location!: string;

  @IsNumber()
  capacity!: number;

  @IsString()
  libraryId: string;

  constructor(name?: string, location?: string, capacity?: number, libraryId?: string) {
    if (!name || !location || typeof capacity !== 'number' || !libraryId) {
      return;
    }

    this.name = name;
    this.location = location;
    this.capacity = capacity;
    this.libraryId = libraryId;
  }
}

export class OwnerDashboardRevenueData {
  @IsNumber()
  today!: number;

  @IsNumber()
  todayChange!: number;

  @IsNumber()
  monthly!: number;

  constructor(today?: number, todayChange?: number, monthly?: number) {
    if (
      typeof today !== 'number' ||
      typeof todayChange !== 'number' ||
      typeof monthly !== 'number'
    ) {
      return;
    }

    this.today = today;
    this.todayChange = todayChange;
    this.monthly = monthly;
  }
}

export class OwnerDashboardSeatsData {
  @IsNumber()
  total!: number;

  @IsNumber()
  occupied!: number;

  @IsNumber()
  pending!: number;

  @IsNumber()
  free!: number;

  constructor(total?: number, occupied?: number, pending?: number, free?: number) {
    if (
      typeof total !== 'number' ||
      typeof occupied !== 'number' ||
      typeof pending !== 'number' ||
      typeof free !== 'number'
    ) {
      return;
    }

    this.total = total;
    this.occupied = occupied;
    this.pending = pending;
    this.free = free;
  }
}

export class OwnerDashboardAlertsData {
  @IsNumber()
  overdue!: number;

  @IsNumber()
  expiringSoon!: number;

  constructor(overdue?: number, expiringSoon?: number) {
    if (typeof overdue !== 'number' || typeof expiringSoon !== 'number') {
      return;
    }

    this.overdue = overdue;
    this.expiringSoon = expiringSoon;
  }
}

export class OwnerDashboardRecentActivityData {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  action!: string;

  @IsString()
  detail!: string;

  @IsString()
  time!: string;

  @IsString()
  color!: string;

  @IsString()
  studentId!: string | null;

  @IsOptional()
  @IsString()
  memberId!: string | null; 

  constructor(params?: {
    id: string;
    name: string;
    action: string;
    detail: string;
    time: string;
    color: string;
    studentId: string | null;
    memberId: string | null;
  }) {
    if (!params) {
      return;
    }

    this.id = params.id;
    this.name = params.name;
    this.action = params.action;
    this.detail = params.detail;
    this.time = params.time;
    this.color = params.color;
    this.studentId = params.studentId;
    this.memberId  = params.memberId;
  }
}

export class OwnerDashboardSubscriptionData {
  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsString()
  planName!: string | null;

  @IsOptional()
  @IsString()
  planId!: string | null;

  @IsOptional()
  @IsString()
  startDate!: string | null;

  @IsOptional()
  @IsString()
  endDate!: string | null;

  @IsNumber()
  daysRemaining!: number;

  @IsOptional()
  @IsString()
  activatedBy!: string | null;

  @IsOptional()
  @IsNumber()
  amount!: number | null;

  @IsOptional()
  @IsString()
  lastPurchasedAt!: string | null;

  constructor(params?: {
    isActive:        boolean;
    planName:        string | null;
    planId:          string | null;
    startDate:       string | null;
    endDate:         string | null;
    daysRemaining:   number;
    activatedBy:     string | null;
    amount:          number | null;
    lastPurchasedAt: string | null;
  }) {
    if (!params) return;
    this.isActive        = params.isActive;
    this.planName        = params.planName;
    this.planId          = params.planId;
    this.startDate       = params.startDate;
    this.endDate         = params.endDate;
    this.daysRemaining   = params.daysRemaining;
    this.activatedBy     = params.activatedBy;
    this.amount          = params.amount;
    this.lastPurchasedAt = params.lastPurchasedAt;
  }
}

export class OwnerDashboardData {
  // @IsString()
  // libraryId!: string;

  @ValidateNested()
  @Type(() => OwnerDashboardLibraryData)
  library!: OwnerDashboardLibraryData;

  @ValidateNested()
  @Type(() => OwnerDashboardRevenueData)
  revenue!: OwnerDashboardRevenueData;

  @ValidateNested()
  @Type(() => OwnerDashboardSeatsData)
  seats!: OwnerDashboardSeatsData;

  @ValidateNested()
  @Type(() => OwnerDashboardAlertsData)
  alerts!: OwnerDashboardAlertsData;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OwnerDashboardRecentActivityData)
  recentActivity!: OwnerDashboardRecentActivityData[];

  @ValidateNested()
  @Type(() => OwnerDashboardSubscriptionData)
  subscription!: OwnerDashboardSubscriptionData;

    @IsOptional()
  @ValidateNested()
  @Type(() => AppUpdateStatusData)
  appUpdate?: AppUpdateStatusData | null; 

  @IsOptional()
@IsBoolean()
isWebViewApiNeedToCall?: boolean;

  constructor(params?: {
    // libraryId: string;
    library: OwnerDashboardLibraryData;
    revenue: OwnerDashboardRevenueData;
    seats: OwnerDashboardSeatsData;
    alerts: OwnerDashboardAlertsData;
    recentActivity: OwnerDashboardRecentActivityData[];
     subscription:   OwnerDashboardSubscriptionData;
     appUpdate?:     AppUpdateStatusData | null; 
     isWebViewApiNeedToCall?: boolean;
  }) {
    if (!params) {
      return;
    }
    // this.libraryId = params.libraryId;
    this.library = params.library;
    this.revenue = params.revenue;
    this.seats = params.seats;
    this.alerts = params.alerts;
    this.recentActivity = params.recentActivity;
    this.subscription   = params.subscription; 
     this.appUpdate      = params.appUpdate ?? null;
     this.isWebViewApiNeedToCall = params.isWebViewApiNeedToCall ?? false;
  }
}

export class OwnerDashboardApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => OwnerDashboardData)
  data!: OwnerDashboardData;

  constructor(data?: OwnerDashboardData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}

