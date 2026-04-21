import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsString, ValidateNested } from 'class-validator';

export class OwnerDashboardLibraryData {
  @IsString()
  name!: string;

  @IsString()
  location!: string;

  @IsNumber()
  capacity!: number;

  constructor(name?: string, location?: string, capacity?: number) {
    if (!name || !location || typeof capacity !== 'number') {
      return;
    }

    this.name = name;
    this.location = location;
    this.capacity = capacity;
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

  constructor(params?: {
    id: string;
    name: string;
    action: string;
    detail: string;
    time: string;
    color: string;
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
  }
}

export class OwnerDashboardData {
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

  constructor(params?: {
    library: OwnerDashboardLibraryData;
    revenue: OwnerDashboardRevenueData;
    seats: OwnerDashboardSeatsData;
    alerts: OwnerDashboardAlertsData;
    recentActivity: OwnerDashboardRecentActivityData[];
  }) {
    if (!params) {
      return;
    }

    this.library = params.library;
    this.revenue = params.revenue;
    this.seats = params.seats;
    this.alerts = params.alerts;
    this.recentActivity = params.recentActivity;
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
