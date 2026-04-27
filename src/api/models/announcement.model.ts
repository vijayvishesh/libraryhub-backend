import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type AnnouncementTarget =
  | 'all'
  | 'fullday'
  | 'firsthalf'
  | 'secondhalf'
  | 'twentyfour'
  | 'overdue';

@Entity('announcements')
@Index('idx_announcements_library_id', ['libraryId'])
export class AnnouncementModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  libraryId!: string;

  @Column()
  ownerId!: string;

  @Column()
  title!: string;

  @Column()
  message!: string;

  @Column()
  target!: AnnouncementTarget;

  @Column()
  sentCount!: number;

  @Column()
  deletedAt!: Date | null;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}