import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class AnalyticsRevenueData {
  @IsNumber() total!: number;
  @IsNumber() collected!: number;
  @IsNumber() pending!: number;
  @IsNumber() changePercent!: number;
}

export class AnalyticsMembersData {
  @IsNumber() total!: number;
  @IsNumber() active!: number;
  @IsNumber() pending!: number;
  @IsNumber() expired!: number;
  @IsNumber() newInRange!: number;
  @IsNumber() churnRate!: number;
}

export class AnalyticsPeakDayData {
  @IsString() date!: string;
  @IsNumber() checkins!: number;
}

export class AnalyticsAttendanceData {
  @IsNumber() totalCheckins!: number;
  @IsNumber() avgDaily!: number;
  @IsNumber() uniqueVisitors!: number;
  @IsOptional()
  @ValidateNested()
  @Type(() => AnalyticsPeakDayData)
  peakDay?: AnalyticsPeakDayData | null;
}

export class AnalyticsSeatsData {
  @IsNumber() total!: number;
  @IsNumber() occupied!: number;
  @IsNumber() occupancyRate!: number;
}

export class AnalyticsSummaryData {
  @ValidateNested() @Type(() => AnalyticsRevenueData) revenue!: AnalyticsRevenueData;
  @ValidateNested() @Type(() => AnalyticsMembersData) members!: AnalyticsMembersData;
  @ValidateNested() @Type(() => AnalyticsAttendanceData) attendance!: AnalyticsAttendanceData;
  @ValidateNested() @Type(() => AnalyticsSeatsData) seats!: AnalyticsSeatsData;
}

export class DailyRevenuePoint {
  @IsString() date!: string;
  @IsNumber() amount!: number;
}

export class DailyMemberGrowthPoint {
  @IsString() date!: string;
  @IsNumber() newMembers!: number;
  @IsNumber() cumulativeTotal!: number;
}

export class DailyAttendancePoint {
  @IsString() date!: string;
  @IsNumber() checkins!: number;
}

export class SlotBreakdownPoint {
  @IsString() slotId!: string;
  @IsString() slotName!: string;
  @IsNumber() members!: number;
  @IsNumber() revenue!: number;
}

export class AnalyticsChartsData {
  @IsArray() @ValidateNested({ each: true }) @Type(() => DailyRevenuePoint)
  revenue!: DailyRevenuePoint[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => DailyMemberGrowthPoint)
  memberGrowth!: DailyMemberGrowthPoint[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => DailyAttendancePoint)
  attendance!: DailyAttendancePoint[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => SlotBreakdownPoint)
  slotBreakdown!: SlotBreakdownPoint[];
}

export class AnalyticsPayloadData {
  @IsString() range!: string;
  @IsString() from!: string;
  @IsString() to!: string;
  @ValidateNested() @Type(() => AnalyticsSummaryData) summary!: AnalyticsSummaryData;
  @ValidateNested() @Type(() => AnalyticsChartsData) charts!: AnalyticsChartsData;
}

export class AnalyticsApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested() @Type(() => AnalyticsPayloadData) data!: AnalyticsPayloadData;

  constructor(data?: AnalyticsPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}