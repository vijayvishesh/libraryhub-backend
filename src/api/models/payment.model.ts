import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export const PAYMENT_STATUS_ENUM = [
  'pending',
  'success',
  'failed',
  'refunded',
  'cancelled',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS_ENUM)[number];

/**
 * Tracks every payment transaction initiated through the platform.
 * Covers Razorpay, direct UPI, and cash bookings.
 */
@Entity('payments')
@Index('idx_payments_userId_createdAt', ['userId', 'createdAt'])
@Index('idx_payments_orderId', ['orderId'])
@Index('idx_payments_status_createdAt', ['paymentStatus', 'createdAt'])
@Index('idx_payments_idempotency', ['idempotencyKey'], { unique: true, sparse: true })
export class PaymentModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  userId!: string;

  @Column()
  libraryId!: string;

  @Column()
  bookingId?: string;

  @Column()
  orderId!: string;

  @Column()
  amount!: number;

  @Column()
  currency!: string;

  @Column()
  paymentMethod!: string;

  @Column()
  transactionId?: string;

  @Column()
  paymentStatus!: PaymentStatus;

  @Column()
  description?: string;

  @Column()
  metadata?: Record<string, unknown>;

  @Column()
  idempotencyKey?: string;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}
