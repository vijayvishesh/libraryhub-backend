import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type BannerDurationUnit = 'days' | 'months' | 'years';

@Entity('sponsored_banners')
@Index('idx_banners_is_active', ['isActive'])
export class BannerModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  title!: string;

  @Column()
  details!: string;

  @Column()
  imageUrl!: string;

  @Column()
  redirectUrl!: string | null;

  @Column()
  sponsorName!: string;

  @Column()
  startDate!: string; // YYYY-MM-DD

  @Column()
  endDate!: string; // YYYY-MM-DD auto calculated

  @Column()
  durationValue!: number;

  @Column()
  durationUnit!: BannerDurationUnit;

  @Column()
  priority!: number;

  @Column()
  isActive!: boolean;

  @Column()
  deletedAt!: Date | null;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}