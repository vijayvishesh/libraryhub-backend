import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type PaymentStatus = 'created' | 'paid' | 'failed' | 'refunded';
export type PaymentPurpose = 'subscription'; // extend later for other purposes

@Entity('subscription_payments')
@Index('idx_subscription_payments_libraryId', ['libraryId'])
@Index('idx_subscription_payments_razorpayOrderId', ['razorpayOrderId'])
@Index('idx_subscription_payments_status', ['status'])
export class SubscriptionPaymentModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  libraryId!: string;

  @Column()
  ownerId!: string;

  @Column()
  purpose!: PaymentPurpose; // 'subscription'

  @Column()
  planId!: string;

  @Column()
  planName!: string;

  @Column()
  amount!: number; // INR

  @Column()
  currency!: string;

  @Column()
  status!: PaymentStatus;

  @Column()
  razorpayOrderId!: string;

  @Column()
  razorpayPaymentId!: string | null;

  @Column()
  razorpaySignature!: string | null;

  @Column()
  receipt!: string;

  @Column()
  // Subscription activated after this payment
  subscriptionId!: string | null;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}