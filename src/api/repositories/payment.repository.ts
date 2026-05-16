import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { PaymentModel, PaymentStatus } from '../models/payment.model';
import {
  CreatePaymentInput,
  ListPaymentsQuery,
  ListPaymentsResult,
  PaymentRecord,
  UpdatePaymentStatusInput,
} from './types/payment.repository.types';

@Service()
export class PaymentRepository {
  public async create(input: CreatePaymentInput): Promise<PaymentRecord> {
    const repo = this.getRepo();
    const now = new Date();
    const payment = repo.create({
      ...input,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repo.save(payment);
    return this.map(saved);
  }

  public async findById(id: string): Promise<PaymentRecord | null> {
    const repo = this.getRepo();
    try {
      const payment = await repo.findOne({ where: { id: new ObjectId(id) } as any });
      return payment ? this.map(payment) : null;
    } catch {
      return null;
    }
  }

  public async findByOrderId(orderId: string): Promise<PaymentRecord | null> {
    const repo = this.getRepo();
    const payment = await repo.findOne({ where: { orderId } });
    return payment ? this.map(payment) : null;
  }

  public async list(query: ListPaymentsQuery): Promise<ListPaymentsResult> {
    const repo = this.getRepo();

    const where: Record<string, unknown> = {};
    if (query.userId) where['userId'] = query.userId;
    if (query.libraryId) where['libraryId'] = query.libraryId;
    if (query.paymentStatus) where['paymentStatus'] = query.paymentStatus;
    if (query.paymentMethod) where['paymentMethod'] = query.paymentMethod;

    const [payments, total] = await Promise.all([
      repo.find({
        where,
        order: { createdAt: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      repo.count({ where }),
    ]);

    return { payments: payments.map(p => this.map(p)), total };
  }

  public async updateStatus(id: string, input: UpdatePaymentStatusInput): Promise<PaymentRecord | null> {
    const repo = this.getRepo();
    try {
      const oid = new ObjectId(id);
      await repo.updateOne(
        { _id: oid },
        {
          $set: {
            paymentStatus: input.paymentStatus,
            ...(input.transactionId !== undefined && { transactionId: input.transactionId }),
            ...(input.metadata !== undefined && { metadata: input.metadata }),
            updatedAt: new Date(),
          },
        },
      );
      return this.findById(id);
    } catch {
      return null;
    }
  }

  public async delete(id: string): Promise<boolean> {
    const repo = this.getRepo();
    try {
      const result = await repo.deleteOne({ _id: new ObjectId(id) });
      return (result.deletedCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  private map(payment: PaymentModel): PaymentRecord {
    return {
      id: payment.id.toHexString(),
      userId: payment.userId,
      libraryId: payment.libraryId,
      bookingId: payment.bookingId,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      transactionId: payment.transactionId,
      paymentStatus: payment.paymentStatus as PaymentStatus,
      description: payment.description,
      metadata: payment.metadata,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  private getRepo(): MongoRepository<PaymentModel> {
    return getDataSource().getMongoRepository(PaymentModel);
  }
}
