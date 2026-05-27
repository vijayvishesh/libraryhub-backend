import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';
import { SubscriptionPlanFeatures } from './subscriptionPlan.model';

export type LibrarySubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'trial';

@Entity('library_subscriptions')
@Index('idx_library_subscriptions_libraryId', ['libraryId'])
@Index('idx_library_subscriptions_status', ['status'])
@Index('idx_library_subscriptions_libraryId_status', ['libraryId', 'status'])
export class LibrarySubscriptionModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  libraryId!: string;

  @Column()
  planId!: string;

  @Column()
  planName!: string;

  // Snapshot of features at time of purchase — plan changes won't affect active subs
  @Column()
  features!: SubscriptionPlanFeatures;

  @Column()
  status!: LibrarySubscriptionStatus;

  @Column()
  activatedBy!: 'owner' | 'admin'; // who activated this subscription

  @Column()
  startDate!: string; // ISO date YYYY-MM-DD

  @Column()
  endDate!: string;   // ISO date YYYY-MM-DD

  @Column()
  amount!: number;

  @Column()
  paymentMethod!: string | null; // null when admin activates manually

  @Column()
  paymentReference!: string | null; // utr/razorpay ref

  @Column()
  notes!: string | null; // admin notes when activating manually

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}