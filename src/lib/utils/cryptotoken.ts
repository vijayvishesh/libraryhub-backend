import * as crypto from 'crypto';
import { env } from '../../env';

const getKey = () => {
  const secret = env.tokenSecret;

  if (!secret) {
    throw new Error('TOKEN_SECRET is not defined');
  }

  const key = Buffer.from(secret, 'hex');

  if (key.length !== 32) {
    throw new Error('TOKEN_SECRET must be 64 hex characters (32 bytes)');
  }

  return key;
};

export type TokenPayload = Record<string, unknown> & {
  exp?: number;
};

export function generateToken<T extends object>(payload: T, expiresInMs: number): string {
  const data: TokenPayload = {
    ...(payload as Record<string, unknown>),
    exp: Date.now() + expiresInMs,
  };

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);

  const encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex') + cipher.final('hex');

  const tag = cipher.getAuthTag();

  return [iv.toString('hex'), encrypted, tag.toString('hex')].join('.');
}

export function verifyToken<T extends object>(token: string): T {
  try {
    const [ivHex, encrypted, tagHex] = token.split('.');

    if (!ivHex || !encrypted || !tagHex) {
      throw new Error('Invalid token format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);

    const decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');

    const payload = JSON.parse(decrypted) as TokenPayload;
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid token payload');
    }
    if (typeof payload.exp === 'number' && payload.exp < Date.now()) {
      throw new Error('Token expired');
    }

    return payload as T;
  } catch {
    throw new Error('Invalid token');
  }
}
