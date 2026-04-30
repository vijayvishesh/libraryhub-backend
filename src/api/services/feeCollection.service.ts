import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { getDataSource } from '../../database/config/ormconfig.default';
import { OwnerFeeCollectionQueryRequest } from '../controllers/requests/booking.request';
import { MemberModel } from '../models/member.model';
import { LibraryRepository } from '../repositories/library.repository';
import { MemberRepository } from '../repositories/member.repository';
import { LibraryRecord } from '../repositories/types/library.repository.types';
import { MemberRecord } from '../repositories/types/member.repository.types';
import {
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
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly memberRepository: MemberRepository,
  ) {}

  public async getOwnerFeeCollection(
    ownerId: string,
    query: OwnerFeeCollectionQueryRequest,
  ): Promise<OwnerFeeCollectionResult> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);

      const tab = query.tab ?? 'pending';
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;

      const [summary, listResult] = await Promise.all([
        this.getFeeCollectionSummary(library.id),
        tab === 'pending'
          ? this.listPendingMembers(library.id, page, limit)
          : this.listPaidTodayMembers(library.id, page, limit),
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

    const memberRepo = getDataSource().getMongoRepository(MemberModel);

    const [todayRows, monthRows, pendingCount] = await Promise.all([
      memberRepo
        .aggregate([
          {
            $match: {
              libraryId,
              paidAt: { $gte: startOfToday, $lt: startOfTomorrow },
              planAmount: { $gt: 0 },
            },
          },
          {
            $group: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              _id: null,
              amount: { $sum: '$planAmount' },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      memberRepo
        .aggregate([
          {
            $match: {
              libraryId,
              paidAt: { $gte: startOfMonth, $lt: startOfTomorrow },
              planAmount: { $gt: 0 },
            },
          },
          {
            $group: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              _id: null,
              amount: { $sum: '$planAmount' },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      memberRepo.count({ where: { libraryId, status: 'pending' } }),
    ]);

    return {
      todayAmount: todayRows[0]?.amount || 0,
      todayPayments: todayRows[0]?.count || 0,
      monthAmount: monthRows[0]?.amount || 0,
      monthPayments: monthRows[0]?.count || 0,
      pendingCount,
    };
  }

  private async listPendingMembers(
    libraryId: string,
    page: number,
    limit: number,
  ): Promise<{ members: MemberRecord[]; total: number }> {
    return this.memberRepository.listMembersByLibrary({
      libraryId,
      page,
      limit,
      status: 'pending',
    });
  }

  private async listPaidTodayMembers(
    libraryId: string,
    page: number,
    limit: number,
  ): Promise<{ members: MemberRecord[]; total: number }> {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);

    const memberRepo = getDataSource().getMongoRepository(MemberModel);
    const whereFilter = {
      libraryId,
      paidAt: { $gte: startOfToday, $lt: startOfTomorrow },
    };

    const [members, total] = await Promise.all([
      memberRepo.find({
        where: whereFilter,
        order: { paidAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      memberRepo.count({ where: whereFilter }),
    ]);

    return {
      members: members.map(m => ({
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
      })),
      total,
    };
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
