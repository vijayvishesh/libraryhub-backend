export type OwnerDashboardRevenue = {
  today: number;
  todayChange: number;
  monthly: number;
};

export type OwnerDashboardSeats = {
  total: number;
  occupied: number;
  pending: number;
  free: number;
};

export type OwnerDashboardAlerts = {
  overdue: number;
  expiringSoon: number;
};

export type OwnerDashboardRecentActivity = {
  id: string;
  name: string;
  action: string;
  detail: string;
  time: string;
  color: string;
  studentId: string | null;
  memberId:  string | null;
};

export type OwnerDashboardResult = {
  library: {
    name: string;
    location: string;
    capacity: number;
    libraryId: string;
  };
  isWebViewApiNeedToCall: boolean;
  revenue: OwnerDashboardRevenue;
  seats: OwnerDashboardSeats;
  alerts: OwnerDashboardAlerts;
  recentActivity: OwnerDashboardRecentActivity[];
  subscription:   OwnerDashboardSubscription;
};

export type OwnerDashboardSubscription = {
  isActive:        boolean;
  planName:        string | null;
  planId:          string | null;
  startDate:       string | null;
  endDate:         string | null;
  daysRemaining:   number;
  activatedBy:     string | null;
  amount:          number | null;
  lastPurchasedAt: string | null; 
};
