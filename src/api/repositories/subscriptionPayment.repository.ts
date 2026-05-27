import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import {
  CreatePaymentInput,
  ListPaymentsQuery,
  ListPaymentsResult,
  PaymentRecord,
  UpdatePaymentInput,
} from './types/subscriptionPayment.repository.types';
import { SubscriptionPaymentModel } from '../models/subscriptionPayment.model';

@Service()
export class SubscriptionPaymentRepository {

  public async createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    const repo = this.getRepo();
    const now  = new Date();
    const payment = repo.create({ ...input, createdAt: now, updatedAt: now });
    const saved   = await repo.save(payment);
    return this.mapPayment(saved);
  }

  public async findById(paymentId: string): Promise<PaymentRecord | null> {
    const objectId = this.tryParseObjectId(paymentId);
    if (!objectId) return null;
    const payment = await this.getRepo().findOneById(objectId);
    if (!payment) return null;
    return this.mapPayment(payment);
  }

  public async findByRazorpayOrderId(
    razorpayOrderId: string,
  ): Promise<PaymentRecord | null> {
    const payment = await this.getRepo().findOneBy({ razorpayOrderId });
    if (!payment) return null;
    return this.mapPayment(payment);
  }

  public async updatePayment(
    paymentId: string,
    input: UpdatePaymentInput,
  ): Promise<PaymentRecord | null> {
    const objectId = this.tryParseObjectId(paymentId);
    if (!objectId) return null;

    const repo    = this.getRepo();
    const payment = await repo.findOneById(objectId);
    if (!payment) return null;

    if (input.status            !== undefined) payment.status            = input.status;
    if (input.razorpayPaymentId !== undefined) payment.razorpayPaymentId = input.razorpayPaymentId;
    if (input.razorpaySignature !== undefined) payment.razorpaySignature = input.razorpaySignature;
    if (input.subscriptionId    !== undefined) payment.subscriptionId    = input.subscriptionId;
    payment.updatedAt = input.updatedAt || new Date();

    const saved = await repo.save(payment);
    return this.mapPayment(saved);
  }

  public async listPayments(query: ListPaymentsQuery): Promise<ListPaymentsResult> {
    const filter: Record<string, unknown> = {};
    if (query.libraryId) filter.libraryId = query.libraryId;
    if (query.ownerId)   filter.ownerId   = query.ownerId;
    if (query.status)    filter.status    = query.status;

    const [payments, total] = await Promise.all([
      this.getRepo().find({
        where: filter,
        order: { createdAt: 'DESC' },
        skip:  (query.page - 1) * query.limit,
        take:  query.limit,
      }),
      this.getRepo().count({ where: filter }),
    ]);

    return { payments: payments.map(p => this.mapPayment(p)), total };
  }

  // ── Private ─────────────────────────────────────────────────────────

  private mapPayment(payment: SubscriptionPaymentModel): PaymentRecord {
    return {
      id:                 payment.id.toHexString(),
      libraryId:          payment.libraryId,
      ownerId:            payment.ownerId,
      purpose:            payment.purpose,
      planId:             payment.planId,
      planName:           payment.planName,
      amount:             payment.amount,
      currency:           payment.currency,
      status:             payment.status,
      razorpayOrderId:    payment.razorpayOrderId,
      razorpayPaymentId:  payment.razorpayPaymentId,
      razorpaySignature:  payment.razorpaySignature,
      receipt:            payment.receipt,
      subscriptionId:     payment.subscriptionId,
      createdAt:          payment.createdAt,
      updatedAt:          payment.updatedAt,
    };
  }

  private tryParseObjectId(value: string): ObjectId | null {
    if (!ObjectId.isValid(value)) return null;
    return new ObjectId(value);
  }

  private getRepo(): MongoRepository<SubscriptionPaymentModel> {
    return getDataSource().getMongoRepository(SubscriptionPaymentModel);
  }
}