export type CreateSubmissionInput = {
  inviteLinkId: string;
  inviteLinkToken: string;
  libraryId: string;
  ownerId: string;
  fullName: string;
  mobileNo: string;
  gender: 'male' | 'female' | 'other';
  startDate: string;
  endDate: string;
  seatId: string | null;
  slotId: string | null;
  isInviteSubmission: boolean;
  isNewUser: boolean;
  isExistingMember: boolean;
  hasPendingFee: boolean;
  pendingFeeAmount: number | null;
  previousEndDate: string | null;
  isDuplicate: boolean;
  bookingId: string | null;
};

export type SubmissionRecord = CreateSubmissionInput & {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  studentId: string | null;
  memberId: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ListSubmissionsQuery = {
  libraryId: string;
  status?: 'pending' | 'approved' | 'rejected';
  page: number;
  limit: number;
};

export type ListSubmissionsResult = {
  submissions: SubmissionRecord[];
  total: number;
};

export type UpdateSubmissionInput = Partial<{
  fullName: string;
  mobileNo: string;
  gender: 'male' | 'female' | 'other';
  startDate: string;
  endDate: string;
  seatId: string | null;
  slotId: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  studentId: string | null;
  memberId: string | null;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  updatedAt: Date;
  isNewUser: boolean;
  isExistingMember: boolean;
  hasPendingFee: boolean;
  pendingFeeAmount: number | null;
  previousEndDate: string | null;
  isDuplicate: boolean;
}>;