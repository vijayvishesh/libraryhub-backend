import { MicroframeworkLoader } from 'microframework-w3tec';
import * as cron from 'node-cron';
import { MemberModel } from '../api/models/member.model';
import { getDataSource } from '../database/config/ormconfig.default';
import redisCache from '../lib/redis/db.redis';
import { Logger } from '../lib/logger';

const log = new Logger(__filename);

const LOCK_KEY = 'cron:member-expiry:lock';
const LOCK_TTL_SECONDS = 3600;

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
    let lockAcquired = false;

    try {
      // Try to acquire a distributed lock to prevent concurrent runs across instances.
      // setNX returns true if the lock was acquired, false if Redis is disabled or lock is held.
      const acquired = await redisCache.setNX(LOCK_KEY, '1', LOCK_TTL_SECONDS);
      if (acquired) {
        lockAcquired = true;
      } else {
        // Distinguish: lock held by another instance (Redis enabled, NX failed) vs Redis disabled.
        // If Redis is disabled, setNX always returns false — we should run without a lock.
        // Test reachability: attempt a GET; if it returns without throwing, Redis is up.
        try {
          await redisCache.get<string>(LOCK_KEY);
          // Redis is reachable → another instance holds the lock, skip this run
          log.info('[Cron] member-expiry lock held by another instance, skipping');
          return;
        } catch {
          // Redis unavailable → run without lock
          log.warn('[Cron] Redis lock unavailable, running member-expiry without lock');
        }
      }
    } catch (lockErr: any) {
      log.warn('[Cron] Redis lock check failed, running without lock:', lockErr?.message);
    }

    try {
      await runMemberExpiryJob();
    } catch (error) {
      log.error('Cron: Member expiry job failed', [error]);
    } finally {
      if (lockAcquired) {
        try {
          await redisCache.delete(LOCK_KEY);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  });

  log.info('Cron jobs loaded');
};
