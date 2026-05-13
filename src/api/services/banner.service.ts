import { NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { BannerRepository } from '../repositories/banner.repository';
import { AnnouncementRepository } from '../repositories/announcement.repository';
import { MemberRepository } from '../repositories/member.repository';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { BannerRecord } from '../repositories/types/banner.repository.types';
import { AnnouncementRecord } from '../repositories/types/announcement.repository.types';
import { CreateBannerRequest, UpdateBannerRequest } from '../controllers/requests/banner.request';
import { BannerDurationUnit } from '../models/banner.model';
import { AnnouncementTarget } from '../models/announcement.model';

export type MembershipAlert = {
  type: 'expiring_soon' | 'expired' | 'overdue';
  title: string;
  message: string;
  endDate: string | null;
  daysRemaining: number; // positive = days left, negative = days overdue
};

@Service()
export class BannerService {
  constructor(
    private readonly bannerRepository: BannerRepository,
    private readonly announcementRepository: AnnouncementRepository,
    private readonly memberRepository: MemberRepository,
    private readonly attendanceRepository: AttendanceRepository,
  ) {}

  public async createBanner(input: CreateBannerRequest): Promise<BannerRecord> {
    const endDate = this.calculateEndDate(
      input.startDate,
      input.durationValue,
      input.durationUnit,
    );

    return this.bannerRepository.create({
      title: input.title,
      details: input.details,
      imageUrl: input.imageUrl,
      redirectUrl: input.redirectUrl || null,
      sponsorName: input.sponsorName,
      startDate: input.startDate,
      endDate,
      durationValue: input.durationValue,
      durationUnit: input.durationUnit,
      priority: input.priority || 1,
      isActive: input.isActive ?? true,
    });
  }

  public async listAllBanners(): Promise<BannerRecord[]> {
    return this.bannerRepository.findAll();
  }

  public async listActiveBanners(): Promise<BannerRecord[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.bannerRepository.findActiveBanners(today);
  }

  public async updateBanner(id: string, input: UpdateBannerRequest): Promise<BannerRecord> {
    const existing = await this.bannerRepository.findById(id);
    if (!existing || existing.deletedAt) throw new NotFoundError('BANNER_NOT_FOUND');

    const startDate = input.startDate || existing.startDate;
    const durationValue = input.durationValue || existing.durationValue;
    const durationUnit = input.durationUnit || existing.durationUnit;
    const endDate = this.calculateEndDate(startDate, durationValue, durationUnit);

    const updated = await this.bannerRepository.update(id, { ...input, endDate });
    if (!updated) throw new NotFoundError('BANNER_NOT_FOUND');
    return updated;
  }

  public async deleteBanner(id: string): Promise<void> {
    const existing = await this.bannerRepository.findById(id);
    if (!existing || existing.deletedAt) throw new NotFoundError('BANNER_NOT_FOUND');
    await this.bannerRepository.softDelete(id);
  }

  // Get active announcements relevant to this student in this library
  public async listActiveAnnouncementsForStudent(
    studentId: string,
    libraryId: string,
  ): Promise<AnnouncementRecord[]> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    const all = await this.announcementRepository.findByLibrary(libraryId);
    const active = all.filter(a =>
      a.isActive &&
      !a.deletedAt &&
      (!a.expiresAt || a.expiresAt.getTime() > now.getTime()),
    );

    if (active.length === 0) return [];

    const member = await this.memberRepository.findMemberByStudentIdAndLibrary(
      studentId,
      libraryId,
    );

    if (!member) {
      return active.filter(a => a.target === 'all');
    }

    const todayAttendance = await this.attendanceRepository.findTodayByStudentAndLibrary(
      studentId,
      libraryId,
      today,
    );
    const checkedInToday = !!todayAttendance;

    return active.filter(a =>
      this.studentMatchesTarget(a.target, member, checkedInToday, today),
    );
  }

  // New: build membership alert cards for the student
  public async getMembershipAlerts(
    studentId: string,
    libraryId: string,
  ): Promise<MembershipAlert[]> {
    const member = await this.memberRepository.findMemberByStudentIdAndLibrary(
      studentId,
      libraryId,
    );

    // No membership in this library — no alerts
    if (!member) return [];

    // Only alert for active, pending, or expired members
    if (!['active', 'pending', 'expired'].includes(member.status)) return [];

    const today = new Date().toISOString().slice(0, 10);
    const endDate = member.endDate;

    // pending with no endDate — fee due alert
    if (member.status === 'pending') {
      return [
        {
          type: 'overdue',
          title: 'Fee Due',
          message: 'Your library fee is pending. Please pay to activate your membership.',
          endDate: endDate ?? null,
          daysRemaining: 0,
        },
      ];
    }

    if (!endDate) return [];

    const daysRemaining = this.getDaysDiff(today, endDate);

    // Already expired
    if (member.status === 'expired' || daysRemaining < 0) {
      const overdueDays = Math.abs(daysRemaining);
      return [
        {
          type: 'overdue',
          title: 'Membership Overdue',
          message:
            overdueDays === 0
              ? 'Your membership expired today. Please renew to continue.'
              : `Your membership expired ${overdueDays} day${overdueDays === 1 ? '' : 's'} ago. Please renew.`,
          endDate,
          daysRemaining, // negative value
        },
      ];
    }

    // Expires today
    if (daysRemaining === 0) {
      return [
        {
          type: 'expiring_soon',
          title: 'Expires Today',
          message: 'Your membership expires today. Renew now to avoid interruption.',
          endDate,
          daysRemaining: 0,
        },
      ];
    }

    // Expiring within 7 days — show a graded alert
    if (daysRemaining <= 7) {
      return [
        {
          type: 'expiring_soon',
          title: `Expiring in ${daysRemaining} Day${daysRemaining === 1 ? '' : 's'}`,
          message: `Your membership expires on ${endDate}. Renew soon to avoid interruption.`,
          endDate,
          daysRemaining,
        },
      ];
    }

    // More than 7 days remaining — no alert needed
    return [];
  }

  // ── Target matching logic ───────────────────────────────────────────────
  private studentMatchesTarget(
    target: AnnouncementTarget,
    member: {
      status: string;
      slotId: string | null;
      endDate: string | null;
    },
    checkedInToday: boolean,
    today: string,
  ): boolean {
    switch (target) {
      case 'all':
        return member.status === 'active';

      case 'absent':
        return member.status === 'active' && !checkedInToday;

      case 'fee_due':
        return member.status === 'pending';

      case 'expired':
        return member.status === 'expired';

      case 'overdue':
        return (
          member.status === 'expired' ||
          member.status === 'pending' ||
          (!!member.endDate && member.endDate < today)
        );

      default:
        return member.status === 'active' && member.slotId === target;
    }
  }

  // Returns positive int if endDate is in the future, negative if past
  private getDaysDiff(today: string, endDate: string): number {
    const todayMs = new Date(`${today}T00:00:00.000Z`).getTime();
    const endMs = new Date(`${endDate}T00:00:00.000Z`).getTime();
    return Math.round((endMs - todayMs) / (1000 * 60 * 60 * 24));
  }

  private calculateEndDate(
    startDate: string,
    durationValue: number,
    durationUnit: BannerDurationUnit,
  ): string {
    const date = new Date(startDate);
    if (durationUnit === 'days') date.setDate(date.getDate() + durationValue);
    else if (durationUnit === 'months') date.setMonth(date.getMonth() + durationValue);
    else if (durationUnit === 'years') date.setFullYear(date.getFullYear() + durationValue);
    return date.toISOString().split('T')[0];
  }
}