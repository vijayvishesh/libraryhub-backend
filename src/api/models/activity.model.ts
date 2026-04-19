import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';
import { ActivityActionType } from '../constants/activity.constants';

export type ActivityMetadata = Record<string, any>;

@Entity('activities')
@Index('idx_activities_user_id', ['userId'])
@Index('idx_activities_action_type', ['actionType'])
@Index('idx_activities_timestamp', ['timestamp'])
export class ActivityModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  userId!: string;

  @Column()
  actionType!: ActivityActionType;

  @Column()
  description!: string;

  @Column({ nullable: true })
  metadata?: ActivityMetadata;

  @Column()
  timestamp!: Date;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}