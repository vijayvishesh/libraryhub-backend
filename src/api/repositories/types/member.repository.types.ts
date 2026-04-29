export type CreateMemberInput = {
  fullName: string;
  mobileNo: string;
  aadharId: string | null;
  studentId: string | null;
  email: string | null;
  duration: number;
  libraryId: string;
  seatId: string | null;
  slotId: string | null;
  status: 'active' | 'inactive' | 'expired' | 'pending';
  planAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  bookingId: string | null;
  paidAt: Date | null;
  notes: string | null;
};

export type MemberRecord = CreateMemberInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateMemberInput = Partial<
  Omit<CreateMemberInput, 'libraryId'> & {
    updatedAt: Date;
  }
>;

export type ListMembersQuery = {
  libraryId: string;
  page: number;
  limit: number;
  search?: string;
  status?: 'active' | 'inactive' | 'expired' | 'pending';
  slotId?: string;
};

export type ListMembersResult = {
  members: MemberRecord[];
  total: number;
};

export type MemberMsgResponse = {
  msg: string;
};
