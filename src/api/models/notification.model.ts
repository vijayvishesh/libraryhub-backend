import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type NotificationType =
  | 'announcement'
  | 'system'
  | 'booking_approved'
  | 'booking_rejected'
  | 'booking_request'
  | 'session_expiry'
  | 'fee_due'
  | 'checkin_reminder'
  | 'slot_starting'
  | 'slot_not_checked_in'
  | 'timetable_reminder'
  | 'revision_reminder';

@Entity('notifications')
@Index('idx_notifications_student_id', ['studentId'])
@Index('idx_notifications_studentId_isRead', ['studentId', 'isRead'])
export class NotificationModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  studentId!: string;

  @Column()
  title!: string;

  @Column()
  message!: string;

  @Column()
  type!: NotificationType;

  @Column()
  referenceId!: string | null;

  @Column()
  isRead!: boolean;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}