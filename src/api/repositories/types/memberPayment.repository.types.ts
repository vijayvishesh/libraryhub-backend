import { MemberPaymentStatus, MemberPaymentType } from "../../models/memberPayment.model";

export type MemberPaymentRecord = {
  id: string;
  memberId: string;
  libraryId: string;
  studentId:           string | null;     
  bookingId:           string | null;     
  amount: number;
  duration: number;
  startDate: string;
  endDate: string;
  paymentMethod:       string | null;    
  paymentScreenshotUrl: string | null;  
  type:                MemberPaymentType;
  status:              MemberPaymentStatus;

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
  page:     number;   
  limit:    number;   
};
