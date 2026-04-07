import { MicroframeworkLoader } from 'microframework-w3tec';

import { Logger } from '../lib/logger';
import redisCache from '../lib/redis/db.redis';

const log = new Logger(__filename);

export const redisLoader: MicroframeworkLoader = async (settings) => {
  if (settings) {
    const redisUrl = process.env.REDIS_URL || '';

    // Sanity check: If the URL contains "redis-cli", it's a configuration error
    if (redisUrl.includes('redis-cli')) {
      log.error('CRITICAL CONFIG ERROR: Redis URL contains "redis-cli" command. Please remove it from .env');
      return;
    }

    try {
      await redisCache.testConnection();
      // ... rest of your code
    } catch (error) {
      log.error('Redis loader error:', error);
    }
  }
};
