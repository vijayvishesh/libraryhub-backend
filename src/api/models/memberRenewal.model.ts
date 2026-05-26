import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('member_renewals')
@Index('idx_renewals_memberId', ['memberId'])
@Index('idx_renewals_studentId_libraryId', ['studentId', 'libraryId'])
export class MemberRenewalModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column() memberId!: string;          // same forever
  @Column() studentId!: string;
  @Column() libraryId!: string;

  // Previous period snapshot
  @Column() previousBookingId!: string | null;
  @Column() previousSeatId!: string | null;
  @Column() previousSlotId!: string | null;
  @Column() previousEndDate!: string | null;

  // New period details
  @Column() newBookingId!: string | null;  // set after owner approves
  @Column() newSeatId!: string;
  @Column() newSlotId!: string;
  @Column() newSlotName!: string;
  @Column() newStartDate!: string;
  @Column() newEndDate!: string;
  @Column() duration!: number;
  @Column() planAmount!: number;
  @Column() paymentMethod!: string;

  // Who triggered
  @Column() renewedBy!: 'student' | 'owner';
  
  // 'pending' → student submitted, awaiting owner
  // 'approved' → owner confirmed, booking created
  // 'rejected' → owner rejected
  @Column() status!: 'pending' | 'approved' | 'rejected';

  @Column() createdAt!: Date;
  @Column() updatedAt!: Date;
}