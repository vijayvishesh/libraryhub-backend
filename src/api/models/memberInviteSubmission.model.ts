import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('member_invite_submissions')
@Index('idx_invite_submissions_token', ['inviteLinkToken'])
@Index('idx_invite_submissions_library', ['libraryId'])
@Index('idx_invite_submissions_status', ['status'])
@Index('idx_invite_submissions_mobile', ['mobileNo'])
export class MemberInviteSubmissionModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  inviteLinkId!: string;

  @Column()
  inviteLinkToken!: string;

  @Column()
  libraryId!: string;

  @Column()
  ownerId!: string;

  // Form fields
  @Column()
  fullName!: string;

  @Column()
  mobileNo!: string;

  @Column()
  gender!: 'male' | 'female' | 'other';

  @Column()
  startDate!: string;

  @Column()
  endDate!: string;

  @Column()
  seatId!: string | null;

  @Column()
  slotId!: string | null;

  @Column()
  isInviteSubmission!: boolean;

  @Column()
  isNewUser!: boolean;

  @Column()
  isExistingMember!: boolean;

  @Column()
  hasPendingFee!: boolean;

  @Column()
  pendingFeeAmount!: number | null;

  @Column()
  previousEndDate!: string | null;

  @Column()
  isDuplicate!: boolean;

  @Column()
  bookingId!: string | null;

  // Staging status
  @Column()
  status!: 'pending' | 'approved' | 'rejected';

  @Column()
  rejectionReason!: string | null;

  @Column()
  studentId!: string | null;

  @Column()
  memberId!: string | null;

  @Column()
  reviewedAt!: Date | null;

  @Column()
  reviewedBy!: string | null;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}
