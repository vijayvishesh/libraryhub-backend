import redisCache from '../redis/db.redis';
import type { AuthScreenContext } from './cookie.helper';

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

interface AuthTokenContext {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn?: string | number | null;
}

interface StoreAuthCacheInput {
  keys: string[];
  username: string;
  token: AuthTokenContext;
  screenContext?: AuthScreenContext | null;
  deviceType?: string;
}

const resolveIdTokenExpiry = (expiresIn?: string | number | null): number => {
  const parsedExpiresIn = typeof expiresIn === 'number' ? expiresIn : Number.parseInt(String(expiresIn ?? ''), 10);

  if (Number.isFinite(parsedExpiresIn) && parsedExpiresIn > 0) {
    return Date.now() + parsedExpiresIn * 1000;
  }

  return Date.now() + ONE_HOUR_IN_MS;
};

export async function storeAuthCache(input: StoreAuthCacheInput): Promise<void> {
  const normalizedKeys = [...new Set(input.keys.filter((key): key is string => Boolean(key)))];
  if (!normalizedKeys.length || !input.username) {
    return;
  }

  const authCachePayload = {
    username: input.username,
    tokens: {
      accessToken: input.token.accessToken,
      idToken: input.token.idToken,
      refreshToken: input.token.refreshToken,
      deviceType: input.deviceType ?? 'WEB',
      idTokenExpiry: resolveIdTokenExpiry(input.token.expiresIn),
      refreshTokenExpiry: Date.now() + ONE_HOUR_IN_MS,
    },
    screenPermission: input.screenContext?.screenPermissions || null,
    authAttributes: input.screenContext?.authAttributes || null,
    mspinInfo: input.screenContext?.mspinInfo || null,
    loginUserType: input.screenContext?.mspinInfo?.['designation_code'],
  };

  await Promise.all(normalizedKeys.map((key) => redisCache.set(key, authCachePayload)));
}
