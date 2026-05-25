import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export const FEE_REQUEST_STATUS_ENUM = ['pending', 'paid', 'cancelled', 'expired'] as const;
export type FeeRequestStatus = (typeof FEE_REQUEST_STATUS_ENUM)[number];

export const FEE_REQUEST_REASON_ENUM = [
  'new_joinee',           // Student just joined the library
  'subscription_expired', // Subscription period has ended
  'subscription_renewal', // Renewal reminder before expiry
  'manual',               // Owner manually sends a custom request
] as const;
export type FeeRequestReason = (typeof FEE_REQUEST_REASON_ENUM)[number];

/**
 * Tracks every fee payment request sent by library owner to student(s).
 * Supports single and bulk dispatch.
 */
@Entity('fee_requests')
@Index('idx_fee_requests_libraryId_createdAt', ['libraryId', 'createdAt'])
@Index('idx_fee_requests_memberId_status', ['memberId', 'status'])
@Index('idx_fee_requests_status_dueDate', ['status', 'dueDate'])
export class FeeRequestModel {
  @ObjectIdColumn()
  id!: ObjectId;

  /** Library that owns this request */
  @Column()
  libraryId!: string;

  /** Owner (OWNER user) who triggered the request */
  @Column()
  ownerId!: string;

  /** The member (MemberModel) this request targets */
  @Column()
  memberId!: string;

  /** Denormalised for fast display without a join */
  @Column()
  studentName!: string;

  @Column()
  studentPhone!: string;

  /** Optional: link back to the booking that caused this */
  @Column()
  bookingId?: string;

  /** Amount the student owes */
  @Column()
  amount!: number;

  @Column()
  currency!: string;

  /** Why the request was created */
  @Column()
  reason!: FeeRequestReason;

  /** Current lifecycle state */
  @Column()
  status!: FeeRequestStatus;

  /** Optional owner note shown to student */
  @Column()
  note?: string;

  /** When payment must be made by */
  @Column()
  dueDate?: string; // ISO date string "YYYY-MM-DD"

  /** Set when student pays */
  @Column()
  paidAt?: Date;

  /** If this was part of a bulk send, group them under one batchId */
  @Column()
  batchId?: string;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}