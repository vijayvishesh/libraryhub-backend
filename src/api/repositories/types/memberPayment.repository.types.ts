export type MemberPaymentRecord = {
  id: string;
  memberId: string;
  libraryId: string;
  amount: number;
  duration: number;
  startDate: string;
  endDate: string;
  paidAt: Date;
  createdAt: Date;
};

export type CreateMemberPaymentInput = Omit<MemberPaymentRecord, 'id' | 'createdAt'>;

export type ListMemberPaymentsQuery = {
  memberId: string;
  libraryId: string;
  page: number;
  limit: number;
};

export type ListMemberPaymentsResult = {
  payments: MemberPaymentRecord[];
  total: number;
};