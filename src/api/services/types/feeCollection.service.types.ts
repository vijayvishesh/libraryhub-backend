export type OwnerFeeCollectionSummaryResult = {
  todayAmount: number;
  todayPayments: number;
  monthAmount: number;
  monthPayments: number;
  pendingCount: number;
};

export type OwnerFeeCollectionItemResult = {
  memberId: string;
  bookingId: string | null;
  studentName: string;
  studentPhone: string;
  seatId: string;
  slotName: string;
  amount: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  overdueDays: number;
};

export type OwnerFeeCollectionResult = {
  summary: OwnerFeeCollectionSummaryResult;
  tab: 'pending' | 'received_today';
  items: OwnerFeeCollectionItemResult[];
  page: number;
  limit: number;
  total: number;
};
