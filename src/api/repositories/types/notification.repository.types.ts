import { NotificationType } from '../../models/notification.model';

export type NotificationRecord = {
  id: string;
  studentId: string;
  title: string;
  message: string;
  type: NotificationType;
  referenceId: string | null;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateNotificationInput = {
  studentId: string;
  title: string;
  message: string;
  type: NotificationType;
  referenceId: string | null;
};