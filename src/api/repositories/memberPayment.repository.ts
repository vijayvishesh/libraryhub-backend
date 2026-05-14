import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { MemberPaymentModel } from '../models/memberPayment.model';
import {
  CreateMemberPaymentInput,
  ListMemberPaymentsQuery,
  ListMemberPaymentsResult,
  MemberPaymentRecord,
} from './types/memberPayment.repository.types';

@Service()
export class MemberPaymentRepository {
  public async createPayment(input: CreateMemberPaymentInput): Promise<MemberPaymentRecord> {
    const repo = this.getRepository();
    const now = new Date();
    const payment = repo.create({
      ...input,
      createdAt: now,
    });

    const saved = await repo.save(payment);
    return this.mapPayment(saved);
  }

  public async listPaymentsByMember(
    query: ListMemberPaymentsQuery,
  ): Promise<ListMemberPaymentsResult> {
    const repo = this.getRepository();
    const filter = {
      memberId: query.memberId,
      libraryId: query.libraryId,
    };

    const [payments, total] = await Promise.all([
      repo.find({
        where: filter,
        order: { createdAt: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      repo.count({ where: filter }),
    ]);

    return {
      payments: payments.map(p => this.mapPayment(p)),
      total,
    };
  }

  private mapPayment(payment: MemberPaymentModel): MemberPaymentRecord {
    return {
      id: payment.id.toHexString(),
      memberId: payment.memberId,
      libraryId: payment.libraryId,
      amount: payment.amount,
      duration: payment.duration,
      startDate: payment.startDate,
      endDate: payment.endDate,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    };
  }

  private getRepository(): MongoRepository<MemberPaymentModel> {
    return getDataSource().getMongoRepository(MemberPaymentModel);
  }
}
