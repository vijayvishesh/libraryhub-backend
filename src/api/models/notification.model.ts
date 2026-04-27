import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type NotificationType = 'announcement' | 'system';

@Entity('notifications')
@Index('idx_notifications_student_id', ['studentId'])
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
  referenceId!: string | null; // announcementId

  @Column()
  isRead!: boolean;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}