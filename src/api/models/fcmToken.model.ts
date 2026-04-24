import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('fcm_tokens')
@Index('idx_fcm_tokens_student_id', ['studentId'])
export class FcmTokenModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  studentId!: string;

  @Column()
  token!: string;

  @Column()
  deviceType!: string; // 'android' | 'ios' | 'web'

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}