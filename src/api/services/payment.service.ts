import * as crypto from 'crypto';
import { HttpError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { BookingRepository } from '../repositories/booking.repository';
import { LibraryRepository } from '../repositories/library.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { PaymentRecord } from '../repositories/types/payment.repository.types';
import {
  CreatePaymentPayload,
  ListPaymentsPayload,
  RazorpayOrderResult,
  UpdatePaymentStatusPayload,
} from './types/payment.service.types';

@Service()
export class PaymentService {
  private readonly keyId: string;
  private readonly keySecret: string;
  private razorpay: any;

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly libraryRepository: LibraryRepository,
    private readonly bookingRepository: BookingRepository,
  ) {
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    if (this.keyId && this.keySecret) {
      const Razorpay = require('razorpay');
      this.razorpay = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    }
  }

  // ─── Razorpay helpers ───────────────────────────────────────────────────────

  public async createRazorpayOrder(
    amountInPaise: number,
    receipt: string,
    bookingId?: string,
    userId?: string,
  ): Promise<RazorpayOrderResult> {
    if (!this.razorpay) {
      throw new Error('RAZORPAY_NOT_CONFIGURED');
    }

    // If bookingId provided, fetch verified amount from DB instead of trusting client
    let verifiedAmountInPaise = amountInPaise;
    if (bookingId && userId) {
      const booking = await this.bookingRepository.findStudentBookingById(userId, bookingId);
      if (!booking) {
        throw new HttpError(403, 'PAYMENT_NOT_AUTHORIZED');
      }
      verifiedAmountInPaise = Math.round(booking.amount * 100);
    }

    const order = await this.razorpay.orders.create({
      amount: verifiedAmountInPaise,
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
    if (!this.keySecret) {
      return false;
    }
    const body = `${orderId}|${paymentId}`;
    const expected = crypto.createHmac('sha256', this.keySecret).update(body).digest('hex');
    return expected === signature;
  }

  public getKeyId(): string {
    return this.keyId;
  }

  // ─── Payment CRUD ───────────────────────────────────────────────────────────

  public async createPayment(
    userId: string,
    payload: CreatePaymentPayload,
  ): Promise<PaymentRecord> {
    // Idempotency: return existing payment if same key was already processed
    if (payload.idempotencyKey) {
      const existing = await this.paymentRepository.findByIdempotencyKey(payload.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    // Verify the booking belongs to this student before recording payment
    if (payload.bookingId) {
      const booking = await this.bookingRepository.findStudentBookingById(
        userId,
        payload.bookingId,
      );
      if (!booking) {
        throw new HttpError(403, 'PAYMENT_NOT_AUTHORIZED');
      }
    }

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
      idempotencyKey: payload.idempotencyKey,
    });
  }

  public async getPaymentById(id: string): Promise<PaymentRecord> {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) {
      throw new NotFoundError('PAYMENT_NOT_FOUND');
    }
    return payment;
  }

  public async listPayments(payload: ListPaymentsPayload): Promise<any> {
    const result = await this.paymentRepository.list({
      userId: payload.userId,
      libraryId: payload.libraryId,
      paymentStatus: payload.paymentStatus,
      paymentMethod: payload.paymentMethod,
      page: payload.page || 1,
      limit: payload.limit || 20,
    });

    // Batch-load payment methods for all unique library IDs in one parallel pass
    // instead of firing N sequential queries (N+1 fix)
    const uniqueLibIds = [...new Set(result.payments.map(p => p.libraryId).filter(Boolean))];
    const methodsByLib = new Map<string, any[]>();
    await Promise.all(
      uniqueLibIds.map(async id => {
        const methods = await this.libraryRepository.getPaymentMethods(id);
        methodsByLib.set(id, methods);
      }),
    );

    const payments = result.payments.map(payment => ({
      ...payment,
      paymentMethods: methodsByLib.get(payment.libraryId) ?? [],
    }));

    return {
      payments,
      total: result.total,
    };
  }

  public async updatePaymentStatus(
    id: string,
    payload: UpdatePaymentStatusPayload,
  ): Promise<PaymentRecord> {
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
