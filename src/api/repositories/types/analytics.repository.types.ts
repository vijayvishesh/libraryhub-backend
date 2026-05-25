export type DateRange = {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
};

export type DailyRevenue = {
  date: string;
  amount: number;
};

export type DailyAttendance = {
  date: string;
  checkins: number;
};

export type DailyMemberGrowth = {
  date: string;
  newMembers: number;
  cumulativeTotal: number;
};

export type SlotBreakdown = {
  slotId: string;
  members: number;
  revenue: number;
};

export type MemberCounts = {
  total: number;
  active: number;
  pending: number;
  expired: number;
  inactive: number;
};

export type PeakDay = {
  date: string;
  checkins: number;
};