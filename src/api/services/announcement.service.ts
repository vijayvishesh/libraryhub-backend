import { NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { getFirebaseMessaging } from '../../lib/firebase/firebase';
import {
  AnnouncementExpiryRequest,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
} from '../controllers/requests/announcement.request';
import { AnnouncementTargetData } from '../controllers/responses/announcement.response';
import { AnnouncementTarget } from '../models/announcement.model';
import { AnnouncementRepository } from '../repositories/announcement.repository';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { FcmTokenRepository } from '../repositories/fcmToken.repository';
import { LibraryRepository } from '../repositories/library.repository';
import { MemberRepository } from '../repositories/member.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { AnnouncementRecord } from '../repositories/types/announcement.repository.types';

// Static non-slot targets
const STATIC_TARGETS: AnnouncementTargetData[] = [
  new AnnouncementTargetData(
    'all',
    'All Active Members',
    'members',
    'Send to all members with active membership',
  ),
  new AnnouncementTargetData(
    'absent',
    'Absent Today',
    'members',
    'Active members who have not checked in today',
  ),
  new AnnouncementTargetData(
    'fee_due',
    'Fee Due',
    'members',
    'Members with pending payment status',
  ),
  new AnnouncementTargetData(
    'expired',
    'Expired Members',
    'members',
    'Members whose membership has expired',
  ),
  new AnnouncementTargetData(
    'overdue',
    'Overdue',
    'members',
    'Members who are expired or have pending fees',
  ),
];

// Slot target metadata
const SLOT_TARGET_META: Record<string, { label: string; description: string }> = {
  fullday: { label: 'Full Day Slot', description: 'Members in the full day slot' },
  firsthalf: { label: 'First Half Slot', description: 'Members in the first half slot' },
  secondhalf: { label: 'Second Half Slot', description: 'Members in the second half slot' },
  twentyfour: { label: '24 Hours Slot', description: 'Members in the 24-hour slot' },
  halfday: { label: 'Half Day Slot', description: 'Members in the half day slot' },
  evening: { label: 'Evening Slot', description: 'Members in the evening slot' },
  morning: { label: 'Morning Slot', description: 'Members in the morning slot' },
  night: { label: 'Night Slot', description: 'Members in the night slot' },
  custom: { label: 'Custom Slot', description: 'Members in the custom slot' },
};

@Service()
export class AnnouncementService {
  constructor(
    private readonly announcementRepository: AnnouncementRepository,
    private readonly memberRepository: MemberRepository,
    private readonly fcmTokenRepository: FcmTokenRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly libraryRepository: LibraryRepository,
    private readonly attendanceRepository: AttendanceRepository,
  ) {}

  // ── Get available targets for this library ──────────────────────────────
  public async getAnnouncementTargets(ownerId: string): Promise<AnnouncementTargetData[]> {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
    if (!library) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }

    // Get active slot types configured in this library
    const activeSlotTypes = library.slots.filter(s => s.isActive).map(s => s.slotType);

    const slotTargets = activeSlotTypes
      .filter(slotType => SLOT_TARGET_META[slotType])
      .map(slotType => {
        const meta = SLOT_TARGET_META[slotType];
        return new AnnouncementTargetData(slotType, meta.label, 'slots', meta.description);
      });

    return [...STATIC_TARGETS, ...slotTargets];
  }

  // ── Create announcement ─────────────────────────────────────────────────
  public async createAnnouncement(
    ownerId: string,
    input: CreateAnnouncementRequest,
  ): Promise<AnnouncementRecord> {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
    if (!library) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }

    const studentIds = await this.getTargetedStudentIds(library.id, input.target);
    const { expiresAt, expiryUnit, expiryValue } = this.resolveExpiry(input.expiry);

    const announcement = await this.announcementRepository.create({
      libraryId: library.id,
      ownerId,
      title: input.title,
      message: input.message,
      target: input.target,
      sentCount: studentIds.length,
      isActive: input.isActive ?? true,
      expiresAt,
      expiryUnit,
      expiryValue,
    });

    if (studentIds.length > 0) {
      await this.notificationRepository.createMany(
        studentIds.map(studentId => ({
          studentId,
          title: input.title,
          message: input.message,
          type: 'announcement' as const,
          referenceId: announcement.id,
        })),
      );
      await this.sendPushNotifications(studentIds, input.title, input.message);
    }

    return announcement;
  }

  // ── List announcements ──────────────────────────────────────────────────
  public async listAnnouncements(ownerId: string): Promise<AnnouncementRecord[]> {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
    if (!library) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }
    return this.announcementRepository.findByLibrary(library.id);
  }

  // ── Update announcement ─────────────────────────────────────────────────
  public async updateAnnouncement(
    ownerId: string,
    id: string,
    input: UpdateAnnouncementRequest,
  ): Promise<AnnouncementRecord> {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
    if (!library) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }

    const existing = await this.announcementRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundError('ANNOUNCEMENT_NOT_FOUND');
    }
    if (existing.libraryId !== library.id) {
      throw new NotFoundError('ANNOUNCEMENT_NOT_FOUND');
    }

    const updatePayload: Partial<typeof existing> = {};
    if (input.title !== undefined) {
      updatePayload.title = input.title;
    }
    if (input.message !== undefined) {
      updatePayload.message = input.message;
    }
    if (input.target !== undefined) {
      updatePayload.target = input.target;
    }
    if (input.isActive !== undefined) {
      updatePayload.isActive = input.isActive;
    }

    if (input.expiry !== undefined) {
      const { expiresAt, expiryUnit, expiryValue } = this.resolveExpiry(input.expiry);
      updatePayload.expiresAt = expiresAt;
      updatePayload.expiryUnit = expiryUnit;
      updatePayload.expiryValue = expiryValue;
    }

    const updated = await this.announcementRepository.update(id, updatePayload);
    if (!updated) {
      throw new NotFoundError('ANNOUNCEMENT_NOT_FOUND');
    }
    return updated;
  }

  // ── Toggle active / inactive ────────────────────────────────────────────
  public async toggleAnnouncement(
    ownerId: string,
    id: string,
    isActive: boolean,
  ): Promise<AnnouncementRecord> {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
    if (!library) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }

    const existing = await this.announcementRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundError('ANNOUNCEMENT_NOT_FOUND');
    }
    if (existing.libraryId !== library.id) {
      throw new NotFoundError('ANNOUNCEMENT_NOT_FOUND');
    }

    const updated = await this.announcementRepository.setActive(id, isActive);
    if (!updated) {
      throw new NotFoundError('ANNOUNCEMENT_NOT_FOUND');
    }
    return updated;
  }

  // ── Delete announcement ─────────────────────────────────────────────────
  public async deleteAnnouncement(ownerId: string, id: string): Promise<void> {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
    if (!library) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }

    const existing = await this.announcementRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundError('ANNOUNCEMENT_NOT_FOUND');
    }
    if (existing.libraryId !== library.id) {
      throw new NotFoundError('ANNOUNCEMENT_NOT_FOUND');
    }

    await this.announcementRepository.softDelete(id);
  }

  // ── Resolve expiry from request ─────────────────────────────────────────
  private resolveExpiry(expiry?: AnnouncementExpiryRequest): {
    expiresAt: Date | null;
    expiryUnit: 'hours' | 'days' | null;
    expiryValue: number | null;
  } {
    if (!expiry) {
      return { expiresAt: null, expiryUnit: null, expiryValue: null };
    }

    // Absolute datetime takes priority
    if (expiry.expiresAt) {
      return {
        expiresAt: new Date(expiry.expiresAt),
        expiryUnit: null,
        expiryValue: null,
      };
    }

    // Duration-based
    if (expiry.unit && expiry.value) {
      const ms =
        expiry.unit === 'hours'
          ? expiry.value * 60 * 60 * 1000
          : expiry.value * 24 * 60 * 60 * 1000;

      return {
        expiresAt: new Date(Date.now() + ms),
        expiryUnit: expiry.unit,
        expiryValue: expiry.value,
      };
    }

    return { expiresAt: null, expiryUnit: null, expiryValue: null };
  }

  // ── Get targeted student IDs ────────────────────────────────────────────
  private async getTargetedStudentIds(
    libraryId: string,
    target: AnnouncementTarget,
  ): Promise<string[]> {
    const allMembers = await this.memberRepository.findAllMembersByLibrary(libraryId);
    const today = new Date().toISOString().split('T')[0];

    // Members who have a studentId
    const withStudent = allMembers.filter(m => m.studentId);

    if (target === 'all') {
      // All active members
      return withStudent.filter(m => m.status === 'active').map(m => m.studentId as string);
    }

    if (target === 'absent') {
      // Active members who have NOT checked in today
      const todayRecords = await this.attendanceRepository.findTodayByLibrary(libraryId, today);
      const checkedInIds = new Set(todayRecords.map(r => r.studentId));
      return withStudent
        .filter(m => m.status === 'active' && m.studentId && !checkedInIds.has(m.studentId))
        .map(m => m.studentId as string);
    }

    if (target === 'fee_due') {
      // Members with pending payment (status = pending)
      return withStudent.filter(m => m.status === 'pending').map(m => m.studentId as string);
    }

    if (target === 'expired') {
      // Members whose status is expired
      return withStudent.filter(m => m.status === 'expired').map(m => m.studentId as string);
    }

    if (target === 'overdue') {
      // Expired OR pending OR endDate passed
      return withStudent
        .filter(m => {
          const isExpired = m.status === 'expired';
          const isPending = m.status === 'pending';
          const isPastEndDate = m.endDate && m.endDate < today;
          return isExpired || isPending || isPastEndDate;
        })
        .map(m => m.studentId as string);
    }

    // Slot-based targets — filter members by slotId matching the target
    const slotTypes = [
      'fullday',
      'firsthalf',
      'secondhalf',
      'twentyfour',
      'halfday',
      'evening',
      'morning',
      'night',
      'custom',
    ];

    if (slotTypes.includes(target)) {
      return withStudent
        .filter(m => m.status === 'active' && m.slotId === target)
        .map(m => m.studentId as string);
    }

    return [];
  }

  // ── FCM push notifications ──────────────────────────────────────────────
  private async sendPushNotifications(
    studentIds: string[],
    title: string,
    message: string,
  ): Promise<void> {
    try {
      const tokens = await this.fcmTokenRepository.findTokensByStudentIds(studentIds);
      if (tokens.length === 0) {
        return;
      }

      const messaging = getFirebaseMessaging();
      const batchSize = 500;

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        await messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title, body: message },
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
      }
    } catch (error) {
      console.warn('[AnnouncementService] FCM push notification failed:', error);
    }
  }
}
