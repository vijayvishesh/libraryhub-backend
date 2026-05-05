import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('members')
@Index('idx_members_library_mobile_unique', ['libraryId', 'mobileNo'], { unique: true })
@Index('idx_members_library_status', ['libraryId', 'status'])
@Index('idx_members_library_paidAt', ['libraryId', 'paidAt'])
@Index('idx_members_library_status_endDate', ['libraryId', 'status', 'endDate'])
export class MemberModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  fullName!: string;

  @Column()
  mobileNo!: string;

  @Column()
  aadharId!: string | null;

  @Column()
  studentId!: string | null;

  @Column()
  email!: string | null;

  @Column()
  duration!: number;

  @Column()
  libraryId!: string;

  @Column()
  seatId!: string | null;

  @Column()
  slotId!: string | null;

  @Column()
  status!: 'active' | 'inactive' | 'expired' | 'pending';

  @Column()
  planAmount!: number | null;

  @Column()
  startDate!: string | null;

  @Column()
  endDate!: string | null;

  @Column()
  bookingId!: string | null;

  @Column()
  paidAt!: Date | null;

  @Column()
  notes!: string | null;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}
