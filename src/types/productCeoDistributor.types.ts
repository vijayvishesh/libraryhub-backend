export interface ProductGroupPerformancePayload {
  fromDate: string;
  toDate: string;
  salesExecutiveMspin?: string;
  distributorCode?: string;
  locationCode?: string;
  partCategory?: string[];
}

export interface MonthRangeContext {
  month: number;
  year: number;
  previousYear: number;
  startDate: Date;
  endDate: Date;
}

export interface ProductPeriodContext {
  month: number;
  year: number;
  partCategory: string[];
}

export interface PotentialQueryContext {
  startDate: Date;
  endDate: Date;
  groupTypes: string[];
  partCategory: string[];
}

export interface IwScopeMatch {
  dealerCode: string;
  mspin?: string;
  location?: string;
  distributorCode?: string;
}

export interface DealerIwCountAggregationResult {
  dealerCode: string;
  iwCount: number;
}

export interface CurrentMonthPerformanceAggregationResult {
  dealerCode: string;
  groupType: string;
  currentMonthTargetAchived: number;
  assignedTarget: number;
  targetDocs: number;
  achivedIwCount: number;
}

export interface LastYearPerformanceAggregationResult {
  dealerCode: string;
  groupType: string;
  lastYearTargetAchived: number;
}

export interface ProductMetricSnapshot {
  groupType: string;
  currentMonthTargetAchived: number;
  lastYearTargetAchived: number;
  targetIw: number;
  achievementIw: number;
}

export interface PotentialAggregationResult {
  groupType: string;
  potential: number;
  totalBilledCount: number;
  assignTargetIwCount: number;
}

export interface ProductGroupNameAggregationResult {
  groupType: string;
  name: string;
}

export interface AggregatedProductMetric extends ProductMetricSnapshot {
  potential: number;
  totalBilledCount: number;
  assignTargetIwCount: number;
  productName: string;
}
