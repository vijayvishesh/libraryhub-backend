import * as crypto from 'crypto';
import { env } from '../../env';

export function encryptPasswordAES(password: string): string {
  const key = Buffer.from(env.passwordEncryptionKey, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}
