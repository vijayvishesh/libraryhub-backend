import { LibraryPaymentMethod } from '../../constants/library.constants';
import { PaymentStatus } from '../../models/payment.model';

export type CreatePaymentInput = {
  userId: string;
  libraryId: string;
  bookingId?: string;
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: LibraryPaymentMethod | string;
  transactionId?: string;
  paymentStatus: PaymentStatus;
  description?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
};

export type UpdatePaymentStatusInput = {
  paymentStatus: PaymentStatus;
  transactionId?: string;
  metadata?: Record<string, unknown>;
};

export type PaymentRecord = CreatePaymentInput & {
  id: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ListPaymentsQuery = {
  userId?: string;
  libraryId?: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string;
  page: number;
  limit: number;
};

export type ListPaymentsResult = {
  payments: PaymentRecord[];
  total: number;
};
