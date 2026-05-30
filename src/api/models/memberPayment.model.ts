import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';
export type MemberPaymentType = 'first_join' | 'renewal';
export type MemberPaymentStatus = 'pending' | 'confirmed';

@Entity('member_payments')
@Index('idx_member_payments_memberId_createdAt', ['memberId', 'createdAt'])
@Index('idx_member_payments_libraryId_createdAt', ['libraryId', 'createdAt'])


export class MemberPaymentModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  memberId!: string;

  @Column()
  libraryId!: string;

  @Column()
  amount!: number;

  @Column()
  duration!: number;

  @Column()
  studentId!: string | null;     

  @Column()
  bookingId!: string | null;

  @Column()
  paymentMethod!: string | null; 

  @Column()
  paymentScreenshotUrl!: string | null; 

  @Column()
  type!: MemberPaymentType;     

  @Column()
  status!: MemberPaymentStatus; 


  @Column()
  startDate!: string;

  @Column()
  endDate!: string;

  @Column()
  paidAt!: Date;

  @Column()
  createdAt!: Date;
}
