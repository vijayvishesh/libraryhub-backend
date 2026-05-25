import { NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { AnalyticsRange } from '../controllers/requests/analytics.request';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { DateRange } from '../repositories/types/analytics.repository.types';
import { LibraryRepository } from '../repositories/library.repository';

export type AnalyticsSummary = {
  revenue: {
    total: number;
    collected: number;
    pending: number;
    changePercent: number;
  };
  members: {
    total: number;
    active: number;
    pending: number;
    expired: number;
    newInRange: number;
    churnRate: number;
  };
  attendance: {
    totalCheckins: number;
    avgDaily: number;
    uniqueVisitors: number;
    peakDay: { date: string; checkins: number } | null;
  };
  seats: {
    total: number;
    occupied: number;
    occupancyRate: number;
  };
};

export type AnalyticsCharts = {
  revenue: { date: string; amount: number }[];
  memberGrowth: { date: string; newMembers: number; cumulativeTotal: number }[];
  attendance: { date: string; checkins: number }[];
  slotBreakdown: { slotId: string; slotName: string; members: number; revenue: number }[];
};

export type AnalyticsResult = {
  range: AnalyticsRange;
  from: string;
  to: string;
  summary: AnalyticsSummary;
  charts: AnalyticsCharts;
};

@Service()
export class AnalyticsService {
  constructor(
    private readonly analyticsRepository: AnalyticsRepository,
    private readonly libraryRepository: LibraryRepository,
  ) {}

  public async getAnalytics(
    ownerId: string,
    range: AnalyticsRange,
  ): Promise<AnalyticsResult> {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
    if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');

    const dateRange = this.resolveDateRange(range);
    const prevRange = this.analyticsRepository.getPreviousRange(dateRange);
    const libraryId = library.id;

    // Fetch all data in parallel
    const [
      totalRevenue,
      prevRevenue,
      pendingRevenue,
      dailyRevenue,
      memberCounts,
      newMembers,
      dailyMemberGrowth,
      totalCheckins,
      dailyAttendance,
      peakDay,
      uniqueVisitors,
      occupiedSeats,
      slotBreakdown,
    ] = await Promise.all([
      this.analyticsRepository.getTotalRevenue(libraryId, dateRange),
      this.analyticsRepository.getTotalRevenue(libraryId, prevRange),
      this.analyticsRepository.getPendingRevenue(libraryId),
      this.analyticsRepository.getDailyRevenue(libraryId, dateRange),
      this.analyticsRepository.getMemberCounts(libraryId),
      this.analyticsRepository.getNewMembersCount(libraryId, dateRange),
      this.analyticsRepository.getDailyMemberGrowth(libraryId, dateRange),
      this.analyticsRepository.getTotalCheckins(libraryId, dateRange),
      this.analyticsRepository.getDailyAttendance(libraryId, dateRange),
      this.analyticsRepository.getPeakAttendanceDay(libraryId, dateRange),
      this.analyticsRepository.getUniqueVisitors(libraryId, dateRange),
      this.analyticsRepository.getOccupiedSeatsCount(libraryId),
      this.analyticsRepository.getSlotBreakdown(libraryId, dateRange),
    ]);

    // Revenue change %
    const revenueChangePercent = prevRevenue === 0
      ? (totalRevenue > 0 ? 100 : 0)
      : Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100);

    // Churn rate = expired / total * 100
    const churnRate = memberCounts.total === 0
      ? 0
      : Math.round((memberCounts.expired / memberCounts.total) * 100);

    // Avg daily checkins
    const days = this.analyticsRepository.fillDateRange(dateRange).length;
    const avgDaily = days === 0 ? 0 : Math.round(totalCheckins / days);

    // Seat occupancy
    const totalSeats = library.totalSeats ?? 0;
    const occupancyRate = totalSeats === 0
      ? 0
      : Math.round((occupiedSeats / totalSeats) * 100);

    // Enrich slot breakdown with slot names from library
    const enrichedSlots = slotBreakdown
      .map(s => {
        const slotInfo = library.slots?.find(sl => sl.slotType === s.slotId);
        return {
          slotId: s.slotId,
          slotName: slotInfo?.name ?? s.slotId,
          members: s.members,
          revenue: s.revenue,
        };
      })
      .sort((a, b) => b.members - a.members);

    return {
      range,
      from: dateRange.from,
      to: dateRange.to,
      summary: {
        revenue: {
          total: totalRevenue,
          collected: totalRevenue,
          pending: pendingRevenue,
          changePercent: revenueChangePercent,
        },
        members: {
          total: memberCounts.total,
          active: memberCounts.active,
          pending: memberCounts.pending,
          expired: memberCounts.expired,
          newInRange: newMembers,
          churnRate,
        },
        attendance: {
          totalCheckins,
          avgDaily,
          uniqueVisitors,
          peakDay,
        },
        seats: {
          total: totalSeats,
          occupied: occupiedSeats,
          occupancyRate,
        },
      },
      charts: {
        revenue: dailyRevenue,
        memberGrowth: dailyMemberGrowth,
        attendance: dailyAttendance,
        slotBreakdown: enrichedSlots,
      },
    };
  }

  private resolveDateRange(range: AnalyticsRange): DateRange {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (range) {
      case 'today':
        return { from: todayStr, to: todayStr };

      case 'week': {
        const from = new Date(today);
        from.setDate(today.getDate() - 6);
        return { from: from.toISOString().split('T')[0], to: todayStr };
      }

      case 'month': {
        const from = new Date(today);
        from.setDate(today.getDate() - 29);
        return { from: from.toISOString().split('T')[0], to: todayStr };
      }

      case 'year': {
        const from = new Date(today);
        from.setFullYear(today.getFullYear() - 1);
        from.setDate(from.getDate() + 1);
        return { from: from.toISOString().split('T')[0], to: todayStr };
      }

      default:
        return { from: todayStr, to: todayStr };
    }
  }
}