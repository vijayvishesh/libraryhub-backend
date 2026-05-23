import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('fcm_tokens')
@Index('idx_fcm_tokens_student_id', ['studentId'])
@Index('idx_fcm_tokens_owner_id', ['ownerId'])
export class FcmTokenModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  studentId!: string | null; // null when owner token

  @Column()
  ownerId!: string | null;   // null when student token

  @Column()
  token!: string;

  @Column()
  deviceType!: string; // 'android' | 'ios' | 'web'

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}