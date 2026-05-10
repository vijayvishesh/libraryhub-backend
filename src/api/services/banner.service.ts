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

  //  get announcements relevant to this student in this library
  public async listActiveAnnouncementsForStudent(
    studentId: string,
    libraryId: string,
  ): Promise<AnnouncementRecord[]> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // 1. Get all active non-expired announcements for this library
    const all = await this.announcementRepository.findByLibrary(libraryId);
    const active = all.filter(a =>
      a.isActive &&
      !a.deletedAt &&
      (!a.expiresAt || a.expiresAt.getTime() > now.getTime()),
    );

    if (active.length === 0) return [];

    // 2. Get student membership in this library
    const member = await this.memberRepository.findMemberByStudentIdAndLibrary(
      studentId,
      libraryId,
    );

    // Student has no membership — only show 'all' target announcements
    if (!member) {
      return active.filter(a => a.target === 'all');
    }

    // 3. Get today's attendance for absent check
    const todayAttendance = await this.attendanceRepository.findTodayByStudentAndLibrary(
      studentId,
      libraryId,
      today,
    );
    const checkedInToday = !!todayAttendance;

    // 4. Filter announcements where this student matches the target
    return active.filter(a =>
      this.studentMatchesTarget(a.target, member, checkedInToday, today),
    );
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
        // Active member who has NOT checked in today
        return member.status === 'active' && !checkedInToday;

      case 'fee_due':
        // Pending payment
        return member.status === 'pending';

      case 'expired':
        // Membership expired
        return member.status === 'expired';

      case 'overdue':
        // Expired OR pending OR past end date
        return (
          member.status === 'expired' ||
          member.status === 'pending' ||
          (!!member.endDate && member.endDate < today)
        );

      default:
        // Slot-based — match member's slotId to the target
        return member.status === 'active' && member.slotId === target;
    }
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