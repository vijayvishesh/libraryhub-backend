import { NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { RegisterFcmTokenRequest } from '../controllers/requests/fcmToken.request';
import { FcmTokenRepository } from '../repositories/fcmToken.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationRecord } from '../repositories/types/notification.repository.types';

@Service()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly fcmTokenRepository: FcmTokenRepository,
  ) {}

  public async listNotifications(studentId: string): Promise<{
    notifications: NotificationRecord[];
    unreadCount: number;
  }> {
    const [notifications, unreadCount] = await Promise.all([
      this.notificationRepository.findByStudent(studentId),
      this.notificationRepository.countUnread(studentId),
    ]);
    return { notifications, unreadCount };
  }

  public async markAsRead(id: string, studentId: string): Promise<NotificationRecord> {
    const notification = await this.notificationRepository.findById(id);
    if (!notification) throw new NotFoundError('NOTIFICATION_NOT_FOUND');
    if (notification.studentId !== studentId) throw new NotFoundError('NOTIFICATION_NOT_FOUND');

    const updated = await this.notificationRepository.markAsRead(id);
    if (!updated) throw new NotFoundError('NOTIFICATION_NOT_FOUND');
    return updated;
  }

  public async markAllAsRead(studentId: string): Promise<void> {
    await this.notificationRepository.markAllAsRead(studentId);
  }

  public async getUnreadCount(studentId: string): Promise<number> {
    return this.notificationRepository.countUnread(studentId);
  }

  public async registerFcmToken(studentId: string, input: RegisterFcmTokenRequest): Promise<void> {
    await this.fcmTokenRepository.upsert({
      studentId,
      token: input.token,
      deviceType: input.deviceType,
    });
  }
}
