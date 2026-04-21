import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { getDataSource } from '../../database/config/ormconfig.default';
import { ActivityActionType } from '../constants/activity.constants';
import { BookingModel } from '../models/booking.model';
import { MemberModel } from '../models/member.model';
import { LibraryRepository } from '../repositories/library.repository';
import { LibraryRecord } from '../repositories/types/library.repository.types';
import { ActivityRecord, ActivityService } from './activity.service';
import { BookingService } from './booking.service';

type OwnerDashboardRevenue = {
  today: number;
  todayChange: number;
  monthly: number;
};

type OwnerDashboardSeats = {
  total: number;
  occupied: number;
  pending: number;
  free: number;
};

type OwnerDashboardAlerts = {
  overdue: number;
  expiringSoon: number;
};

type OwnerDashboardRecentActivity = {
  id: string;
  name: string;
  action: string;
  detail: string;
  time: string;
  color: string;
};

export type OwnerDashboardResult = {
  library: {
    name: string;
    location: string;
    capacity: number;
  };
  revenue: OwnerDashboardRevenue;
  seats: OwnerDashboardSeats;
  alerts: OwnerDashboardAlerts;
  recentActivity: OwnerDashboardRecentActivity[];
};

@Service()
export class OwnerService {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly bookingService: BookingService,
    private readonly activityService: ActivityService,
  ) {}

  public async getDashboard(ownerId: string): Promise<OwnerDashboardResult> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const seatMap = await this.bookingService.getLibrarySeatMap(library.id);
      const pendingSeatCount = await this.getPendingSeatCount(library.id);
      const occupiedSeatCount = seatMap.seats.filter(item => item.occupied).length;
      const totalSeatCount = seatMap.seats.length;
      const freeSeatCount = Math.max(0, totalSeatCount - occupiedSeatCount - pendingSeatCount);

      const [revenue, alerts, recentActivity] = await Promise.all([
        this.getRevenueStats(library.id),
        this.getAlertStats(library.id),
        this.getRecentActivity(ownerId),
      ]);

      return {
        library: {
          name: library.name,
          location: this.formatLibraryLocation(library),
          capacity: library.totalSeats,
        },
        revenue,
        seats: {
          total: totalSeatCount,
          occupied: occupiedSeatCount,
          pending: pendingSeatCount,
          free: freeSeatCount,
        },
        alerts,
        recentActivity,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GET_OWNER_DASHBOARD_FAILED');
    }
  }

  private async getOwnerLibraryOrThrow(ownerId: string): Promise<LibraryRecord> {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId.trim());
    if (!library) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }

    return library;
  }

  private async getRevenueStats(libraryId: string): Promise<OwnerDashboardRevenue> {
    const now = new Date();
    const startOfToday = this.startOfDay(now);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setUTCDate(startOfYesterday.getUTCDate() - 1);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);
    const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const timeBucketGroup = this.buildTimeBucketGroup(
      startOfToday,
      startOfTomorrow,
      startOfYesterday,
    );

    const ds = getDataSource();
    const [bookingResults, memberResults] = await Promise.all([
      ds
        .getMongoRepository(BookingModel)
        .aggregate([
          {
            $match: {
              libraryId,
              status: { $in: ['confirmed', 'checked_in', 'checked_out'] },
              createdAt: { $gte: startOfYesterday, $lt: startOfNextMonth },
            },
          },
          { $group: { ...timeBucketGroup, revenue: { $sum: '$amount' } } },
        ])
        .toArray(),
      ds
        .getMongoRepository(MemberModel)
        .aggregate([
          {
            $match: {
              libraryId,
              status: { $in: ['active', 'pending'] },
              planAmount: { $gt: 0 },
              createdAt: { $gte: startOfYesterday, $lt: startOfNextMonth },
            },
          },
          { $group: { ...timeBucketGroup, revenue: { $sum: '$planAmount' } } },
        ])
        .toArray(),
    ]);

    const revenueMap: Record<string, number> = {};
    for (const row of [...bookingResults, ...memberResults]) {
      const key = row['_id'] as string;
      revenueMap[key] = (revenueMap[key] || 0) + (row.revenue || 0);
    }

    const todayRevenue = revenueMap['today'] || 0;
    const yesterdayRevenue = revenueMap['yesterday'] || 0;
    const monthlyRevenue =
      (revenueMap['today'] || 0) + (revenueMap['yesterday'] || 0) + (revenueMap['other'] || 0);

    const todayChange =
      yesterdayRevenue === 0
        ? todayRevenue > 0
          ? 100
          : 0
        : Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100);

    return { today: todayRevenue, todayChange, monthly: monthlyRevenue };
  }

  private buildTimeBucketGroup(startOfToday: Date, startOfTomorrow: Date, startOfYesterday: Date) {
    return {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      _id: {
        $switch: {
          branches: [
            {
              case: {
                $and: [
                  { $gte: ['$createdAt', startOfToday] },
                  { $lt: ['$createdAt', startOfTomorrow] },
                ],
              },
              then: 'today',
            },
            {
              case: {
                $and: [
                  { $gte: ['$createdAt', startOfYesterday] },
                  { $lt: ['$createdAt', startOfToday] },
                ],
              },
              then: 'yesterday',
            },
          ],
          default: 'other',
        },
      },
    };
  }

  private async getPendingSeatCount(libraryId: string): Promise<number> {
    const bookingRepository = getDataSource().getMongoRepository(BookingModel);
    const todayIsoDate = new Date().toISOString().slice(0, 10);

    return bookingRepository.count({
      where: {
        libraryId,
        status: 'pending',
        validUntil: { $gte: todayIsoDate },
      },
    });
  }

  private async getAlertStats(libraryId: string): Promise<OwnerDashboardAlerts> {
    const now = this.startOfDay(new Date());
    const nowIso = now.toISOString().slice(0, 10);
    const expiringWindow = new Date(now);
    expiringWindow.setUTCDate(expiringWindow.getUTCDate() + 7);
    const expiringIso = expiringWindow.toISOString().slice(0, 10);

    const pipeline = [
      { $match: { libraryId, endDate: { $ne: null } } },
      {
        $group: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          _id: null,
          overdue: { $sum: { $cond: [{ $lt: ['$endDate', nowIso] }, 1, 0] } },
          expiringSoon: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ['$endDate', nowIso] }, { $lte: ['$endDate', expiringIso] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ];

    const results = await getDataSource()
      .getMongoRepository(MemberModel)
      .aggregate(pipeline)
      .toArray();

    const row = results[0];
    return {
      overdue: row?.overdue || 0,
      expiringSoon: row?.expiringSoon || 0,
    };
  }

  private async getRecentActivity(ownerId: string): Promise<OwnerDashboardRecentActivity[]> {
    const activities = await this.activityService.listRecentActivities(ownerId.trim(), 3);
    return activities.map(item => this.mapRecentActivity(item));
  }

  private mapRecentActivity(activity: ActivityRecord): OwnerDashboardRecentActivity {
    const baseName = this.extractActivityName(activity);
    const mappedAction = this.mapActivityAction(activity.actionType);
    const detail = this.extractActivityDetail(activity);

    return {
      id: activity.id,
      name: baseName,
      action: mappedAction.action,
      detail,
      time: this.formatTimeAgo(activity.timestamp),
      color: mappedAction.color,
    };
  }

  private extractActivityName(activity: ActivityRecord): string {
    const metadata = activity.metadata || {};
    const memberName = metadata.memberName;
    const genericName = metadata.name;

    if (typeof memberName === 'string' && memberName.trim()) {
      return memberName.trim();
    }

    if (typeof genericName === 'string' && genericName.trim()) {
      return genericName.trim();
    }

    return 'Library Activity';
  }

  private extractActivityDetail(activity: ActivityRecord): string {
    const metadata = activity.metadata || {};
    const seatId = metadata.seatId;
    const amount = metadata.amount;

    if (typeof seatId === 'string' && seatId.trim()) {
      return `Seat ${seatId.trim()}`;
    }

    if (typeof amount === 'number') {
      return `INR ${amount}`;
    }

    if (activity.description && activity.description.trim()) {
      return activity.description.trim();
    }

    return '-';
  }

  private static readonly ACTION_MAP: Record<string, { action: string; color: string }> = {
    CHECKED_STUDENT: { action: 'Checked in', color: 'teal' },
    PAYMENT_RECEIVED: { action: 'Payment received', color: 'purple' },
    MEMBERSHIP_EXPIRED: { action: 'Membership expired', color: 'red' },
    NEW_MEMBER_ADDED: { action: 'New member added', color: 'blue' },
    MEMBER_UPDATED: { action: 'Member updated', color: 'orange' },
    MEMBER_REMOVED: { action: 'Member removed', color: 'gray' },
    LIBRARY_CREATED: { action: 'Library created', color: 'green' },
    LIBRARY_UPDATED: { action: 'Library updated', color: 'indigo' },
  };

  private mapActivityAction(actionType: ActivityActionType): { action: string; color: string } {
    return OwnerService.ACTION_MAP[actionType] || { action: 'Activity', color: 'slate' };
  }

  private formatLibraryLocation(library: LibraryRecord): string {
    const address = library.address?.trim();
    const city = library.city?.trim();
    const state = library.state?.trim();

    if (address && city) {
      return `${address}, ${city}`;
    }

    if (city && state) {
      return `${city}, ${state}`;
    }

    return city || state || 'N/A';
  }

  private formatTimeAgo(timestamp: Date): string {
    const nowMs = Date.now();
    const thenMs = timestamp.getTime();
    const diffMs = Math.max(0, nowMs - thenMs);
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) {
      return 'just now';
    }

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  private startOfDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
}
