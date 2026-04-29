import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';
import { LibraryPaymentMethod, LibrarySlotType } from '../constants/library.constants';

export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';

@Entity('bookings')
@Index('idx_bookings_student_created_at', ['studentId', 'createdAt'])
@Index('idx_bookings_library_slot_seat', ['libraryId', 'slotType', 'seatId'])
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
  startDate!: string;

  @Column()
  validUntil!: string;

  @Column()
  status!: BookingStatus;

  @Column()
  checkedInAt!: Date | null;

  @Column()
  checkedOutAt!: Date | null;

  @Column()
  invoiceNo!: string;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;

  @Column()
duration!: number;

}
