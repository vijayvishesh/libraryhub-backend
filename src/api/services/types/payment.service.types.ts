import { PaymentStatus } from '../../models/payment.model';

export type CreatePaymentPayload = {
  libraryId: string;
  bookingId?: string;
  orderId: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  transactionId?: string;
  paymentStatus?: PaymentStatus;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type UpdatePaymentStatusPayload = {
  paymentStatus: PaymentStatus;
  transactionId?: string;
  metadata?: Record<string, unknown>;
};

export type ListPaymentsPayload = {
  userId?: string;
  libraryId?: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  page?: number;
  limit?: number;
};

export type RazorpayOrderResult = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
};
