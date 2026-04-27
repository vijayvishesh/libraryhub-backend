import { NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { getFirebaseMessaging } from '../../lib/firebase/firebase';
import { AnnouncementRepository } from '../repositories/announcement.repository';
import { FcmTokenRepository } from '../repositories/fcmToken.repository';
import { MemberRepository } from '../repositories/member.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { LibraryRepository } from '../repositories/library.repository';
import { BookingRepository } from '../repositories/booking.repository';
import { AnnouncementRecord } from '../repositories/types/announcement.repository.types';
import { AnnouncementTarget } from '../models/announcement.model';
import { CreateAnnouncementRequest } from '../controllers/requests/announcement.request';

@Service()
export class AnnouncementService {
  constructor(
    private readonly announcementRepository: AnnouncementRepository,
    private readonly memberRepository: MemberRepository,
    private readonly fcmTokenRepository: FcmTokenRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly libraryRepository: LibraryRepository,
    private readonly bookingRepository: BookingRepository,
  ) {}

  public async createAnnouncement(
    ownerId: string,
    input: CreateAnnouncementRequest,
  ): Promise<AnnouncementRecord> {
    // Get owner library
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
    if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');

    // Get targeted student IDs
    const studentIds = await this.getTargetedStudentIds(library.id, input.target);

    // Create announcement
    const announcement = await this.announcementRepository.create({
      libraryId: library.id,
      ownerId,
      title: input.title,
      message: input.message,
      target: input.target,
      sentCount: studentIds.length,
    });

    // Create notifications in DB for each student
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

      // Send FCM push notifications
      await this.sendPushNotifications(studentIds, input.title, input.message);
    }

    return announcement;
  }

  public async listAnnouncements(ownerId: string): Promise<AnnouncementRecord[]> {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
    if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');
    return this.announcementRepository.findByLibrary(library.id);
  }

  private async getTargetedStudentIds(
    libraryId: string,
    target: AnnouncementTarget,
  ): Promise<string[]> {
    const allMembers = await this.memberRepository.findAllMembersByLibrary(libraryId);
    const today = new Date().toISOString().split('T')[0];

    let targeted = allMembers.filter(m => m.studentId);

    if (target === 'all') {
      targeted = targeted.filter(m => m.status === 'active');
    } else if (target === 'overdue') {
      targeted = targeted.filter(m => {
        const isExpired = m.endDate && m.endDate < today;
        const isPending = m.status === 'pending';
        return isExpired || isPending;
      });
    } else {
      // Filter by slot type
      const slotMap: Record<string, string> = {
        fullday: 'fullday',
        firsthalf: 'firsthalf',
        secondhalf: 'secondhalf',
        twentyfour: 'twentyfour',
      };

      const slotType = slotMap[target];
      if (slotType) {
        // Get members with this slot type from bookings
        const bookingSlotMembers = await this.getStudentIdsBySlotType(libraryId, slotType);
        targeted = targeted.filter(
          m => m.studentId && bookingSlotMembers.has(m.studentId),
        );
      }
    }

    return targeted
      .map(m => m.studentId)
      .filter((id): id is string => id !== null);
  }

  private async getStudentIdsBySlotType(
    libraryId: string,
    slotType: string,
  ): Promise<Set<string>> {
    const seatIds = await this.bookingRepository.findActiveSeatIdsByLibraryAndSlot(
      libraryId,
      slotType,
    );
    const members = await this.memberRepository.findAllMembersByLibrary(libraryId);
    const studentIds = new Set<string>();
    members.forEach(m => {
      if (m.studentId && m.seatId && seatIds.includes(m.seatId)) {
        studentIds.add(m.studentId);
      }
    });
    return studentIds;
  }

  private async sendPushNotifications(
    studentIds: string[],
    title: string,
    message: string,
  ): Promise<void> {
    try {
      const tokens = await this.fcmTokenRepository.findTokensByStudentIds(studentIds);
      if (tokens.length === 0) return;

      const messaging = getFirebaseMessaging();

      // Send in batches of 500 (FCM limit)
      const batchSize = 500;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        await messaging.sendEachForMulticast({
          tokens: batch,
          notification: {
            title,
            body: message,
          },
          android: {
            priority: 'high',
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
              },
            },
          },
        });
      }
    } catch (error) {
      // Push notification failure should not block announcement creation
      console.error('FCM push notification failed:', error);
    }
  }
}