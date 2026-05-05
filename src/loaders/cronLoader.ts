import { MicroframeworkLoader } from 'microframework-w3tec';
import * as cron from 'node-cron';
import { MemberModel } from '../api/models/member.model';
import { getDataSource } from '../database/config/ormconfig.default';
import { Logger } from '../lib/logger';

const log = new Logger(__filename);

export async function runMemberExpiryJob(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const memberRepo = getDataSource().getMongoRepository(MemberModel);

  const result = await memberRepo.updateMany(
    { status: 'active', endDate: { $lt: today } },
    { $set: { status: 'expired', paidAt: null, updatedAt: new Date() } },
  );

  if (result.modifiedCount > 0) {
    log.info(`Cron: Expired ${result.modifiedCount} members`);
  }

  return result.modifiedCount;
}

export const cronLoader: MicroframeworkLoader = () => {
  cron.schedule('0 0,12 * * *', async () => {
    try {
      await runMemberExpiryJob();
    } catch (error) {
      log.error('Cron: Member expiry job failed', [error]);
    }
  });

  log.info('Cron jobs loaded');
};
