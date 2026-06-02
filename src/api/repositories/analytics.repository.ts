import { Service } from 'typedi';
import { getDataSource } from '../../database/config/ormconfig.default';
import { AttendanceModel } from '../models/attendance.model';
import { MemberModel } from '../models/member.model';
import { MemberPaymentModel } from '../models/memberPayment.model';

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

@Service()
export class AnalyticsRepository {

  // ── Helpers ───────────────────────────────────────────────────────────────

  private toUTCStart(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00.000Z');
  }

  private toUTCEnd(dateStr: string): Date {
    return new Date(dateStr + 'T23:59:59.999Z');
  }

  private toISTDateString(date: Date): string {
    // IST = UTC + 5:30
    return new Date(date.getTime() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
  }

  // ── Revenue ───────────────────────────────────────────────────────────────

  public async getTotalRevenue(libraryId: string, range: DateRange): Promise<number> {
    const repo = getDataSource().getMongoRepository(MemberPaymentModel);
    const payments = await repo.find({
      where: {
        libraryId,
        status: 'paid',
        paidAt: {
          $gte: this.toUTCStart(range.from),
          $lte: this.toUTCEnd(range.to),
        },
      } as any,
    });
    return payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  }

  public async getDailyRevenue(libraryId: string, range: DateRange): Promise<DailyRevenue[]> {
    const repo = getDataSource().getMongoRepository(MemberPaymentModel);
    const payments = await repo.find({
      where: {
        libraryId,
        status: 'paid',
        paidAt: {
          $gte: this.toUTCStart(range.from),
          $lte: this.toUTCEnd(range.to),
        },
      } as any,
    });

    const map = new Map<string, number>();
    for (const p of payments) {
      const istDate = this.toISTDateString(new Date(p.paidAt));
      map.set(istDate, (map.get(istDate) ?? 0) + (p.amount ?? 0));
    }

    return this.fillDateRange(range).map(date => ({
      date,
      amount: map.get(date) ?? 0,
    }));
  }

  public async getPendingRevenue(libraryId: string): Promise<number> {
    const repo = getDataSource().getMongoRepository(MemberPaymentModel);
    const payments = await repo.find({
      where: {
        libraryId,
        status: 'pending',
      } as any,
    });
    return payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  }

  // ── Members ───────────────────────────────────────────────────────────────

  public async getMemberCounts(libraryId: string): Promise<{
    total: number;
    active: number;
    pending: number;
    expired: number;
    inactive: number;
  }> {
    const repo = getDataSource().getMongoRepository(MemberModel);
    const [total, active, pending, expired, inactive] = await Promise.all([
      repo.count({ where: { libraryId } as any }),
      repo.count({ where: { libraryId, status: 'active' } as any }),
      repo.count({ where: { libraryId, status: 'pending' } as any }),
      repo.count({ where: { libraryId, status: 'expired' } as any }),
      repo.count({ where: { libraryId, status: 'inactive' } as any }),
    ]);
    return { total, active, pending, expired, inactive };
  }

  public async getNewMembersCount(libraryId: string, range: DateRange): Promise<number> {
    const repo = getDataSource().getMongoRepository(MemberModel);
    return repo.count({
      where: {
        libraryId,
        createdAt: {
          $gte: this.toUTCStart(range.from),
          $lte: this.toUTCEnd(range.to),
        },
      } as any,
    });
  }

  public async getDailyMemberGrowth(
    libraryId: string,
    range: DateRange,
  ): Promise<DailyMemberGrowth[]> {
    const repo = getDataSource().getMongoRepository(MemberModel);

    const members = await repo.find({
      where: {
        libraryId,
        createdAt: { $lte: this.toUTCEnd(range.to) },
      } as any,
    });

    const baseline = members.filter(
      m => this.toISTDateString(new Date(m.createdAt)) < range.from,
    ).length;

    const newMap = new Map<string, number>();
    for (const m of members) {
      const date = this.toISTDateString(new Date(m.createdAt));
      if (date >= range.from && date <= range.to) {
        newMap.set(date, (newMap.get(date) ?? 0) + 1);
      }
    }

    let cumulative = baseline;
    return this.fillDateRange(range).map(date => {
      const newMembers = newMap.get(date) ?? 0;
      cumulative += newMembers;
      return { date, newMembers, cumulativeTotal: cumulative };
    });
  }

  // ── Attendance ────────────────────────────────────────────────────────────

  public async getTotalCheckins(libraryId: string, range: DateRange): Promise<number> {
    const repo = getDataSource().getMongoRepository(AttendanceModel);
    return repo.count({
      where: {
        libraryId,
        date: {
          $gte: range.from,
          $lte: range.to,
        },
      } as any,
    });
  }

  public async getDailyAttendance(
    libraryId: string,
    range: DateRange,
  ): Promise<DailyAttendance[]> {
    const repo = getDataSource().getMongoRepository(AttendanceModel);
    const records = await repo.find({
      where: {
        libraryId,
        date: {
          $gte: range.from,
          $lte: range.to,
        },
      } as any,
    });

    const map = new Map<string, number>();
    for (const r of records) {
      map.set(r.date, (map.get(r.date) ?? 0) + 1);
    }

    return this.fillDateRange(range).map(date => ({
      date,
      checkins: map.get(date) ?? 0,
    }));
  }

  public async getPeakAttendanceDay(
    libraryId: string,
    range: DateRange,
  ): Promise<{ date: string; checkins: number } | null> {
    const daily = await this.getDailyAttendance(libraryId, range);
    if (daily.length === 0) return null;
    const peak = daily.reduce((max, d) => (d.checkins > max.checkins ? d : max), daily[0]);
    return peak.checkins === 0 ? null : peak;
  }

  public async getUniqueVisitors(libraryId: string, range: DateRange): Promise<number> {
    const repo = getDataSource().getMongoRepository(AttendanceModel);
    const records = await repo.find({
      where: {
        libraryId,
        date: {
          $gte: range.from,
          $lte: range.to,
        },
      } as any,
    });
    return new Set(records.map(r => r.studentId)).size;
  }

  // ── Slots ─────────────────────────────────────────────────────────────────

  public async getSlotBreakdown(
    libraryId: string,
    range: DateRange,
  ): Promise<SlotBreakdown[]> {
    const memberRepo = getDataSource().getMongoRepository(MemberModel);
    const paymentRepo = getDataSource().getMongoRepository(MemberPaymentModel);

    const [members, payments] = await Promise.all([
      memberRepo.find({
        where: { libraryId, status: 'active' } as any,
      }),
      paymentRepo.find({
        where: {
          libraryId,
          status: 'paid',
          paidAt: {
            $gte: this.toUTCStart(range.from),
            $lte: this.toUTCEnd(range.to),
          },
        } as any,
      }),
    ]);

    const slotMemberMap = new Map<string, number>();
    for (const m of members) {
      if (!m.slotId) continue;
      slotMemberMap.set(m.slotId, (slotMemberMap.get(m.slotId) ?? 0) + 1);
    }

    const memberSlotMap = new Map<string, string>();
    for (const m of members) {
      if (m.slotId) {
        memberSlotMap.set(
          (m.id || (m as any)._id).toHexString(),
          m.slotId,
        );
      }
    }

    const slotRevenueMap = new Map<string, number>();
    for (const p of payments) {
      const slotId = memberSlotMap.get(p.memberId);
      if (slotId) {
        slotRevenueMap.set(slotId, (slotRevenueMap.get(slotId) ?? 0) + (p.amount ?? 0));
      }
    }

    const allSlotIds = new Set([...slotMemberMap.keys(), ...slotRevenueMap.keys()]);
    return Array.from(allSlotIds).map(slotId => ({
      slotId,
      members: slotMemberMap.get(slotId) ?? 0,
      revenue: slotRevenueMap.get(slotId) ?? 0,
    }));
  }

  // ── Seat Occupancy ────────────────────────────────────────────────────────

  public async getOccupiedSeatsCount(libraryId: string): Promise<number> {
    const repo = getDataSource().getMongoRepository(MemberModel);
    const members = await repo.find({
      where: {
        libraryId,
        status: 'active',
        seatId: { $ne: null },
      } as any,
    });
    return new Set(members.map(m => m.seatId)).size;
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  public getPreviousRange(range: DateRange): DateRange {
    const from = new Date(range.from);
    const to = new Date(range.to);
    const days = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
    const prevFrom = new Date(prevTo.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    return {
      from: prevFrom.toISOString().split('T')[0],
      to: prevTo.toISOString().split('T')[0],
    };
  }

  public fillDateRange(range: DateRange): string[] {
    const dates: string[] = [];
    const current = new Date(range.from);
    const end = new Date(range.to);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }
}