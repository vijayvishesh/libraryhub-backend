import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';
import { LibraryPaymentMethod, LibrarySlotType } from '../constants/library.constants';

export type BookingStatus =
  | 'pending'
  | 'pending_approval'
  | 'pending_payment'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'rejected'
  | 'expired';

export type BookingPaymentStatus =
  | 'not_initiated'
  | 'cash_pending'
  | 'screenshot_uploaded'
  | 'reminder_sent'
  | 'paid'
  | 'failed';

@Entity('bookings')
@Index('idx_bookings_student_created_at', ['studentId', 'createdAt'])
@Index('idx_bookings_library_slot_seat', ['libraryId', 'slotType', 'seatId'])
@Index('idx_bookings_libraryId_status', ['libraryId', 'status'])
@Index('idx_bookings_studentId', ['studentId'])
export class BookingModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  libraryId!: string;

  @Column()
  studentId!: string;

  @Column()
  libraryName!: string;

  @Column()
  libraryAddress!: string;

  @Column()
  slotType!: LibrarySlotType;

  @Column()
  slotName!: string;

  @Column()
  slotStartTime!: string;

  @Column()
  slotEndTime!: string;

  @Column()
  seatId!: string;

  @Column()
  sectionId!: string | null;

  @Column()
  paymentMethod!: LibraryPaymentMethod;

  @Column()
  amount!: number;

  @Column()
  duration!: number;

  @Column()
  startDate!: string;

  @Column()
  validUntil!: string;

  @Column()
  status!: BookingStatus;

  @Column()
  paymentStatus?: BookingPaymentStatus | null; 

  @Column()
  paymentReminderSentAt?: Date | null;          

  @Column()
  checkedInAt!: Date | null;

  @Column()
  checkedOutAt!: Date | null;

  @Column()
  invoiceNo!: string;

  @Column()
  utrNumber?: string;

  @Column()
  razorpayOrderId?: string;

  @Column()
  razorpayPaymentId?: string;

  @Column()
  paymentScreenshotUrl?: string | null;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}