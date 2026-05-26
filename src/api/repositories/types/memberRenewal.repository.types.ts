export type CreateMemberRenewalInput = {
  memberId: string;
  studentId: string;
  libraryId: string;

  // Snapshot of previous period
  previousBookingId: string | null;
  previousSeatId: string | null;
  previousSlotId: string | null;
  previousEndDate: string | null;

  // New period details
  newBookingId: string | null;
  newSeatId: string;
  newSlotId: string;
  newSlotName: string;
  newStartDate: string;
  newEndDate: string;
  duration: number;
  planAmount: number;
  paymentMethod: string;

  // Who triggered renewal
  renewedBy: 'student' | 'owner';

  // pending = student submitted, approved = owner confirmed, rejected = owner rejected
  status: 'pending' | 'approved' | 'rejected';
};

export type MemberRenewalRecord = CreateMemberRenewalInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateMemberRenewalInput = {
  status?: 'pending' | 'approved' | 'rejected';
  newBookingId?: string | null;
  updatedAt?: Date;
};

export type ListMemberRenewalsQuery = {
  memberId?: string;
  studentId?: string;
  libraryId?: string;
  status?: 'pending' | 'approved' | 'rejected';
  page: number;
  limit: number;
};

export type ListMemberRenewalsResult = {
  renewals: MemberRenewalRecord[];
  total: number;
};