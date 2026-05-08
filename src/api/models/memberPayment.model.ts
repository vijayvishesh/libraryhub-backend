import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

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
  startDate!: string;

  @Column()
  endDate!: string;

  @Column()
  paidAt!: Date;

  @Column()
  createdAt!: Date;
}