import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type SubscriptionPlanFeatures = {
  maxMembers: number;
  seatMap: boolean;
  attendanceTracking: boolean;
  feeCollection: boolean;
  renewalManagement: boolean;
  reportAnalytics: boolean;
  multipleSlots: boolean;
  studentApp: boolean;
  pushNotifications: boolean;
  exportReports: boolean;
  customBranding: boolean;
  apiAccess: boolean;
};

@Entity('subscription_plans')
@Index('idx_subscription_plans_isActive', ['isActive'])
export class SubscriptionPlanModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  name!: string; // 'Basic' | 'Pro' | 'Enterprise'

  @Column()
  description!: string;

  @Column()
  price!: number; // in INR

  @Column()
  durationDays!: number; // 30, 90, 365

  @Column()
  features!: SubscriptionPlanFeatures;

  @Column()
  isActive!: boolean; // admin can disable a plan

  @Column()
  sortOrder!: number; // display order

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}