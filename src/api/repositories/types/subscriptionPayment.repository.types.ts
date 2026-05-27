// import { PaymentPurpose, PaymentStatus } from '../../models/payment.model';

import { PaymentPurpose, PaymentStatus } from "../../models/subscriptionPayment.model";

export type CreatePaymentInput = {
  libraryId:          string;
  ownerId:            string;
  purpose:            PaymentPurpose;
  planId:             string;
  planName:           string;
  amount:             number;
  currency:           string;
  status:             PaymentStatus;
  razorpayOrderId:    string;
  razorpayPaymentId:  string | null;
  razorpaySignature:  string | null;
  receipt:            string;
  subscriptionId:     string | null;
};

export type PaymentRecord = CreatePaymentInput & {
  id:        string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdatePaymentInput = Partial<{
  status:            PaymentStatus;
  razorpayPaymentId: string;
  razorpaySignature: string;
  subscriptionId:    string;
  updatedAt:         Date;
}>;

export type ListPaymentsQuery = {
  libraryId?: string;
  ownerId?:   string;
  status?:    PaymentStatus;
  page:       number;
  limit:      number;
};

export type ListPaymentsResult = {
  payments: PaymentRecord[];
  total:    number;
};