import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';

@Entity('member_leave_requests')
@Index('idx_leave_requests_memberId', ['memberId'])
@Index('idx_leave_requests_libraryId_status', ['libraryId', 'status'])
@Index('idx_leave_requests_studentId', ['studentId'])
export class MemberLeaveRequestModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  memberId!: string;

  @Column()
  studentId!: string;

  @Column()
  libraryId!: string;

  @Column()
  bookingId!: string | null;

  @Column()
  reason!: string | null;

  @Column()
  status!: LeaveRequestStatus; // 'pending' | 'approved' | 'rejected'

  @Column()
  rejectionReason!: string | null;

  @Column()
  resolvedAt!: Date | null;  // when owner approved/rejected

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}