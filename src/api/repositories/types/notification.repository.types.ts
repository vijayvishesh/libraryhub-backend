import { NotificationType } from '../../models/notification.model';

export type NotificationRecord = {
  id: string;
  studentId: string | null;
  ownerId: string | null;
  title: string;
  message: string;
  type: NotificationType;
  referenceId: string | null;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateNotificationInput = {
  studentId?: string | null;
  ownerId?: string | null;
  title: string;
  message: string;
  type: NotificationType;
  referenceId?: string | null;
};