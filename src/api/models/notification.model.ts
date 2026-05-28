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
  | 'revision_reminder'
  | 'member_expired'
  | 'renewal_request'       
  | 'renewal_approved'      
  | 'renewal_rejected'     
  | 'payment_received'     
  | 'payment_screenshot'    
  | 'subscription_expiring';

export type NotificationAudience = 'student' | 'owner';

@Entity('notifications')
@Index('idx_notifications_student_id', ['studentId'])
@Index('idx_notifications_owner_id', ['ownerId'])
@Index('idx_notifications_studentId_isRead', ['studentId', 'isRead'])
@Index('idx_notifications_ownerId_isRead', ['ownerId', 'isRead'])
export class NotificationModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  studentId!: string | null;

  @Column()
  ownerId!: string | null; 

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