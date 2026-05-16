import * as crypto from 'crypto';
import { Service } from 'typedi';
import { NotFoundError } from 'routing-controllers';
import { PaymentRepository } from '../repositories/payment.repository';
import { PaymentRecord } from '../repositories/types/payment.repository.types';
import { ListPaymentsResult } from '../repositories/types/payment.repository.types';
import {
  CreatePaymentPayload,
  ListPaymentsPayload,
  RazorpayOrderResult,
  UpdatePaymentStatusPayload,
} from './types/payment.service.types';
import { LibraryRepository } from '../repositories/library.repository';

@Service()
export class PaymentService {
  private readonly keyId: string;
  private readonly keySecret: string;
  private razorpay: any;

  constructor(private readonly paymentRepository: PaymentRepository,
      private readonly libraryRepository: LibraryRepository,

  ) {
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    if (this.keyId && this.keySecret) {
      const Razorpay = require('razorpay');
      this.razorpay = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    }
  }

  // ─── Razorpay helpers ───────────────────────────────────────────────────────

  public async createRazorpayOrder(amountInPaise: number, receipt: string): Promise<RazorpayOrderResult> {
    if (!this.razorpay) {
      throw new Error('RAZORPAY_NOT_CONFIGURED');
    }
    const order = await this.razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
    });
    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: this.keyId,
    };
  }

  public verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!this.keySecret) return false;
    const body = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac('sha256', this.keySecret).update(body).digest('hex');
    return expected === signature;
  }

  public getKeyId(): string {
    return this.keyId;
  }

  // ─── Payment CRUD ───────────────────────────────────────────────────────────

  public async createPayment(userId: string, payload: CreatePaymentPayload): Promise<PaymentRecord> {
    return this.paymentRepository.create({
      userId,
      libraryId: payload.libraryId,
      bookingId: payload.bookingId,
      orderId: payload.orderId,
      amount: payload.amount,
      currency: payload.currency || 'INR',
      paymentMethod: payload.paymentMethod,
      transactionId: payload.transactionId,
      paymentStatus: payload.paymentStatus || 'pending',
      description: payload.description,
      metadata: payload.metadata,
    });
  }

  public async getPaymentById(id: string): Promise<PaymentRecord> {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) {
      throw new NotFoundError('PAYMENT_NOT_FOUND');
    }
    return payment;
  }

// replace complete method
public async listPayments(payload: ListPaymentsPayload): Promise<any> {
  const result = await this.paymentRepository.list({
    userId: payload.userId,
    libraryId: payload.libraryId,
    paymentStatus: payload.paymentStatus,
    paymentMethod: payload.paymentMethod,
    page: payload.page || 1,
    limit: payload.limit || 20,
  });

  const payments = await Promise.all(
    result.payments.map(async payment => {
      const paymentMethods =
        await this.libraryRepository.getPaymentMethods(
          payment.libraryId,
        );

      return {
        ...payment,
        paymentMethods,
      };
    }),
  );

  return {
    payments,
    total: result.total,
  };
}

  public async updatePaymentStatus(id: string, payload: UpdatePaymentStatusPayload): Promise<PaymentRecord> {
    const updated = await this.paymentRepository.updateStatus(id, {
      paymentStatus: payload.paymentStatus,
      transactionId: payload.transactionId,
      metadata: payload.metadata,
    });
    if (!updated) {
      throw new NotFoundError('PAYMENT_NOT_FOUND');
    }
    return updated;
  }

  public async deletePayment(id: string): Promise<boolean> {
    const deleted = await this.paymentRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError('PAYMENT_NOT_FOUND');
    }
    return true;
  }
}
