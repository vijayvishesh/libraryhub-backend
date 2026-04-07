import Redis from 'ioredis';
import { env } from '../../env';
import { Logger } from '../../lib/logger';

const log = new Logger(__filename);

class RedisCache {
  private readonly client: Redis | null = null;
  private readonly isEnabled: boolean;

  constructor() {
    this.isEnabled = env.redis.enabled;

    if (this.isEnabled) {
      this.client = new Redis({
        host: env.redis.host,
        port: env.redis.port,
        keyPrefix: `${env.redis.keyPrefix}:`,
        db: env.redis.db,
        connectTimeout: 10000, // 10 seconds
        tls: {},
        maxRetriesPerRequest: 3,
        commandTimeout: 5000, // 5 seconds timeout for commands
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });

      this.client.on('error', (err) => log.error('Redis Connection Error:', err));
      this.client.on('connect', () => log.info('Redis Connected Successfully'));
      this.client.on('ready', () => log.info('Redis Client Ready'));
      this.client.on('close', () => log.warn('Redis Connection Closed'));
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      log.warn('Redis is not enabled or client is null');
      return false;
    }

    try {
      // Ensure connection is established
      await this.client.connect();

      const result = await this.client.ping();
      log.info(`Redis connection test result: ${result}`);
      return result === 'PONG';
    } catch (error) {
      log.error('Redis connection test failed:', error);
      return false;
    }
  }

  private async ensureConnection(): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      return false;
    }

    try {
      if (this.client.status !== 'ready') {
        await this.client.connect();
      }
      return true;
    } catch (error) {
      log.error('Failed to ensure Redis connection:', error);
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled || !this.client) {
      return null;
    }

    const connected = await this.ensureConnection();
    if (!connected) {
      log.error('Cannot get Redis key - connection not available');
      return null;
    }

    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      log.error(`Redis GET Error [${key}]:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      log.warn('Redis is not enabled or client is null');
      return false;
    }

    const connected = await this.ensureConnection();
    if (!connected) {
      log.error('Cannot set Redis key - connection not available');
      return false;
    }
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
      return true;
    } catch (error) {
      log.error(`Redis SET Error [${key}]:`, error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.isEnabled || !this.client) {
      return false;
    }

    const connected = await this.ensureConnection();
    if (!connected) {
      log.error('Cannot delete Redis key - connection not available');
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      log.error(`Redis DELETE Error [${key}]:`, error);
      return false;
    }
  }
}

export default new RedisCache();
