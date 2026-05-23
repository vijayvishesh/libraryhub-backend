import { NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { NotificationRepository } from '../repositories/notification.repository';
import { NotificationRecord } from '../repositories/types/notification.repository.types';

export type OwnerNotificationListResult = {
  notifications: NotificationRecord[];
  total: number;
  unreadCount: number;
};

@Service()
export class OwnerNotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
  ) {}

  public async listNotifications(ownerId: string): Promise<OwnerNotificationListResult> {
    const [notifications, unreadCount] = await Promise.all([
      this.notificationRepository.findByOwner(ownerId),
      this.notificationRepository.countUnreadByOwner(ownerId),
    ]);

    return {
      notifications,
      total: notifications.length,
      unreadCount,
    };
  }

  public async getUnreadCount(ownerId: string): Promise<number> {
    return this.notificationRepository.countUnreadByOwner(ownerId);
  }

  public async markAsRead(id: string, ownerId: string): Promise<NotificationRecord> {
    const updated = await this.notificationRepository.markAsReadByOwner(id, ownerId);
    if (!updated) {
      throw new NotFoundError('NOTIFICATION_NOT_FOUND');
    }
    return updated;
  }

  public async markAllAsRead(ownerId: string): Promise<void> {
    await this.notificationRepository.markAllAsReadByOwner(ownerId);
  }
}