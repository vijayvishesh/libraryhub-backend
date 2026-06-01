import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type AnnouncementTarget =
  | 'all'
  | 'absent'
  | 'fee_due'
  | 'expired'
  | 'overdue'
  | 'fullday'
  | 'firsthalf'
  | 'secondhalf'
  | 'twentyfour'
  | 'halfday'
  | 'evening'
  | 'morning'
  | 'night'
  | 'afternoon'  
  | 'latenight'  
  | 'weekend'    
  | 'weekday'    
  | 'custom';

@Entity('announcements')
@Index('idx_announcements_library_id', ['libraryId'])
@Index('idx_announcements_active', ['libraryId', 'isActive'])
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

  // ── Active / Inactive ──────────────────────────────────
  @Column()
  isActive!: boolean;

  // ── Expiry — either absolute datetime OR duration ──────
  @Column()
  expiresAt!: Date | null; // absolute expiry datetime

  @Column()
  expiryUnit!: 'hours' | 'days' | null; // for duration-based

  @Column()
  expiryValue!: number | null; // e.g. 2 hours / 1 day

  @Column()
  deletedAt!: Date | null;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;

  @Column()
  memberIds!: string[] | null;
}
