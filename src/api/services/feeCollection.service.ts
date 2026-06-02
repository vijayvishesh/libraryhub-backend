/* eslint-disable @typescript-eslint/naming-convention */
import { BadRequestError, HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { getDataSource } from '../../database/config/ormconfig.default';
import { OwnerFeeCollectionQueryRequest } from '../controllers/requests/booking.request';
import { MemberModel } from '../models/member.model';
import { LibraryRepository } from '../repositories/library.repository';
import { LibraryRecord } from '../repositories/types/library.repository.types';
import { MemberRecord } from '../repositories/types/member.repository.types';
import {
  FeeCollectionTab,
  OwnerFeeCollectionItemResult,
  OwnerFeeCollectionResult,
  OwnerFeeCollectionSummaryResult,
} from './types/feeCollection.service.types';

export type {
  OwnerFeeCollectionItemResult,
  OwnerFeeCollectionResult,
  OwnerFeeCollectionSummaryResult,
};

@Service()
export class FeeCollectionService {
  constructor(private readonly libraryRepository: LibraryRepository) {}

  public async getOwnerFeeCollection(
    ownerId: string,
    query: OwnerFeeCollectionQueryRequest,
  ): Promise<OwnerFeeCollectionResult> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);

      const tab: FeeCollectionTab = query.tab ?? 'pending';
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;

      const [summary, listResult] = await Promise.all([
        this.getFeeCollectionSummary(library.id),
        this.listMembersByTab(library.id, tab, page, limit, query),
      ]);

      return {
        summary,
        tab,
        items: listResult.members.map(m => this.mapFeeCollectionItem(m)),
        page,
        limit,
        total: listResult.total,
      };
    } catch (error) {
      this.rethrowError(error, 'GET_OWNER_FEE_COLLECTION_FAILED');
    }
  }

  private async listMembersByTab(
    libraryId: string,
    tab: FeeCollectionTab,
    page: number,
    limit: number,
    query: OwnerFeeCollectionQueryRequest,
  ): Promise<{ members: MemberRecord[]; total: number }> {
    if (tab === 'pending') {
      const memberRepo = getDataSource().getMongoRepository(MemberModel);
      const filter = { libraryId, status: { $in: ['pending', 'expired'] } };
      const [members, total] = await Promise.all([
        memberRepo.find({
          where: filter,
          order: { createdAt: 'DESC' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        memberRepo.count({ where: filter }),
      ]);
      return { members: members.map(m => this.mapMemberModel(m)), total };
    }

    if (tab === 'expiring') {
      return this.listExpiringMembers(libraryId, query.expiringRange ?? 'today', page, limit);
    }

    return this.listCollectedMembers(libraryId, query.collectedRange ?? 'today', page, limit, query.fromDate,query.toDate,);
  }

  private async listExpiringMembers(
    libraryId: string,
    range: 'today' | '3Days' | '7Days' | 'month',
    page: number,
    limit: number,
  ): Promise<{ members: MemberRecord[]; total: number }> {
    const today = new Date().toISOString().slice(0, 10);
    const rangeEnd = this.getExpiringRangeEnd(range);

    const memberRepo = getDataSource().getMongoRepository(MemberModel);
    const whereFilter = {
      libraryId,
      status: 'active',
      endDate: { $gte: today, $lte: rangeEnd },
    };

    const [members, total] = await Promise.all([
      memberRepo.find({
        where: whereFilter,
        order: { endDate: 'ASC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      memberRepo.count({ where: whereFilter }),
    ]);

    return {
      members: members.map(m => this.mapMemberModel(m)),
      total,
    };
  }

private async listCollectedMembers(
  libraryId: string,
  range: 'today' | 'week' | 'month' | 'lastMonth' | 'custom',
  page: number,
  limit: number,
  fromDate?: string,
  toDate?: string,
): Promise<{ members: MemberRecord[]; total: number }> {
  const { start, end } = this.getCollectedDateRange(range, fromDate, toDate);

  const memberRepo = getDataSource().getMongoRepository(MemberModel);

  // Filter on updatedAt (when owner activated/approved the member)
  // AND status must be active — meaning payment was collected
  const whereFilter = {
    libraryId,
    status: 'active',
    updatedAt: { $gte: start, $lt: end },
  };

  const [members, total] = await Promise.all([
    memberRepo.find({
      where: whereFilter,
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    memberRepo.count({ where: whereFilter }),
  ]);

  return {
    members: members.map(m => this.mapMemberModel(m)),
    total,
  };
}

  private async getFeeCollectionSummary(
    libraryId: string,
  ): Promise<OwnerFeeCollectionSummaryResult> {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const today = now.toISOString().slice(0, 10);
    const d7 = new Date();
    d7.setDate(d7.getDate() + 7);
    const date7 = d7.toISOString().slice(0, 10);

    const memberRepo = getDataSource().getMongoRepository(MemberModel);

    const results = await memberRepo
      .aggregate([
        { $match: { libraryId } },
        {
          $facet: {
            today: [
              {
                $match: {
                  status: 'active',                                    // ← was checking paidAt
                  updatedAt: { $gte: startOfToday, $lt: startOfTomorrow },
                  planAmount: { $gt: 0 },
                },
              },
              { $group: { _id: null, amount: { $sum: '$planAmount' }, count: { $sum: 1 } } },
            ],
            month: [
              {
                $match: {
                  status: 'active',                                    // ← was checking paidAt
                  updatedAt: { $gte: startOfMonth, $lt: startOfTomorrow },
                  planAmount: { $gt: 0 },
                },
              },
              { $group: { _id: null, amount: { $sum: '$planAmount' }, count: { $sum: 1 } } },
            ],
            pending: [{ $match: { status: { $in: ['pending', 'expired'] } } }, { $count: 'count' }],
            expiring: [
              {
                $match: {
                  status: 'active',
                  endDate: { $gte: today, $lte: date7 },
                  planAmount: { $gt: 0 },
                },
              },

              { $group: { _id: null, amount: { $sum: '$planAmount' }, count: { $sum: 1 } } },
            ],
          },
        },
      ])
      .toArray();

    const facet = results[0] || {};
    return {
      todayAmount: facet.today?.[0]?.amount || 0,
      todayPayments: facet.today?.[0]?.count || 0,
      monthAmount: facet.month?.[0]?.amount || 0,
      monthPayments: facet.month?.[0]?.count || 0,
      pendingCount: facet.pending?.[0]?.count || 0,
      expiringCount: facet.expiring?.[0]?.count || 0,
      expiringAmount: facet.expiring?.[0]?.amount || 0,
    };
  }

  private getExpiringRangeEnd(range: 'today' | '3Days' | '7Days' | 'month'): string {
    const d = new Date();
    const daysMap = { today: 0, '3Days': 3, '7Days': 7, month: 30 };
    d.setDate(d.getDate() + daysMap[range]);
    return d.toISOString().slice(0, 10);
  }

private getCollectedDateRange(
  range: 'today' | 'week' | 'month' | 'lastMonth' | 'custom',
  fromDate?: string,
  toDate?: string,
): { start: Date; end: Date } {
  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

  if (range === 'custom') {
    if (!fromDate || !toDate) {
      throw new BadRequestError('fromDate and toDate are required for custom range');
    }
    const start = new Date(`${fromDate}T00:00:00.000Z`);
    const end = new Date(`${toDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1); // make toDate inclusive
    return { start, end };
  }

  if (range === 'today') {
    return { start: startOfToday, end: startOfTomorrow };
  }

  if (range === 'week') {
    // ✅ Fixed — last 7 days including today, not Sunday-based
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - 6);
    return { start: startOfWeek, end: startOfTomorrow };
  }

  if (range === 'month') {
    // ✅ Calendar month start
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { start: startOfMonth, end: startOfTomorrow };
  }

  // lastMonth
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const endOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start: startOfLastMonth, end: endOfLastMonth };
}

  private mapFeeCollectionItem(member: MemberRecord): OwnerFeeCollectionItemResult {
    const todayIsoDate = new Date().toISOString().slice(0, 10);
    const overdueDays =
      member.status === 'pending'
        ? this.calculateOverdueDays(member.endDate || todayIsoDate, todayIsoDate)
        : 0;

    return {
      memberId: member.id,
      bookingId: member.bookingId,
      studentName: member.fullName,
      studentPhone: member.mobileNo,
      seatId: member.seatId || '-',
      slotName: member.slotId || '-',
      amount: member.planAmount || 0,
      status: member.status,
      dueDate: member.endDate || '-',
      paidAt: member.paidAt ? member.paidAt.toISOString() : null,
      overdueDays,
    };
  }

  private mapMemberModel(m: MemberModel): MemberRecord {
    return {
      id: m.id.toHexString(),
      fullName: m.fullName,
      mobileNo: m.mobileNo,
      aadharId: m.aadharId ?? null,
      studentId: m.studentId ?? null,
      email: m.email,
      duration: m.duration,
      libraryId: m.libraryId,
      seatId: m.seatId ?? null,
      slotId: m.slotId ?? null,
      status: m.status,
      planAmount: m.planAmount ?? null,
      startDate: m.startDate ?? null,
      endDate: m.endDate ?? null,
      bookingId: m.bookingId ?? null,
      paidAt: m.paidAt ?? null,
      notes: m.notes ?? null,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  }

  private async getOwnerLibraryOrThrow(ownerId: string): Promise<LibraryRecord> {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId.trim());
    if (!library) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }

    return library;
  }

  private calculateOverdueDays(dueDateIso: string, todayIsoDate: string): number {
    const dueDate = new Date(`${dueDateIso}T00:00:00.000Z`);
    const todayDate = new Date(`${todayIsoDate}T00:00:00.000Z`);
    if (Number.isNaN(dueDate.getTime()) || Number.isNaN(todayDate.getTime())) {
      return 0;
    }

    if (todayDate <= dueDate) {
      return 0;
    }

    const diffMs = todayDate.getTime() - dueDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  private rethrowError(error: unknown, defaultMessage: string): never {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new InternalServerError(defaultMessage);
  }
}
