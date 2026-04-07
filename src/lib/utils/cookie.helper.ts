import { CookieOptions, Request, Response } from 'express';
import { AuthAttribute, ScreenPermission } from '../../api/controllers/responses/user.response';
import { env } from '../../env';

// 1. Define Cookie Names as Constants to avoid typos across the app
export const AUTH_COOKIES = {
  ACCESS_TOKEN: 'accessToken',
  ID_TOKEN: 'idToken',
  REFRESH_TOKEN: 'refreshToken',
  SESSION_TOKEN: 'sessionToken',
  SCREEN_CONTEXT: 'screenContext',
} as const;

const resolveRequest = (req?: Request, res?: Response): Request | undefined => req ?? (res?.req as Request | undefined);

const getRequestProtocol = (req?: Request): string | undefined => {
  const forwarded = req?.headers?.['x-forwarded-proto'];
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim();
  }
  return req?.protocol;
};

const isHttpsRequest = (req?: Request): boolean => {
  const protocol = getRequestProtocol(req);
  if (!protocol) {
    return env.isProduction || env.cookie.secure;
  }
  return protocol === 'https';
};

const getRequestOrigin = (req?: Request): string | undefined => {
  if (!req) {
    return undefined;
  }
  const host = req.get('host');
  if (!host) {
    return undefined;
  }
  const protocol = getRequestProtocol(req);
  if (!protocol) {
    return undefined;
  }
  return `${protocol}://${host}`;
};

const isCrossSiteRequest = (req?: Request): boolean => {
  const originHeader = req?.headers?.origin;
  if (!originHeader || typeof originHeader !== 'string') {
    return false;
  }
  const requestOrigin = getRequestOrigin(req);
  if (!requestOrigin) {
    return false;
  }
  return originHeader !== requestOrigin;
};

const buildBaseCookieOptions = (req?: Request): CookieOptions => {
  const isHttps = isHttpsRequest(req);
  const isCrossSite = isCrossSiteRequest(req);

  if (isCrossSite) {
    return {
      httpOnly: env.cookie.httpOnly ?? true,
      secure: true,
      sameSite: 'none',
      path: '/',
    };
  }
  return {
    httpOnly: env.cookie.httpOnly ?? true, // Default to true for security
    secure: isHttps,
    sameSite: isHttps ? (env.cookie.sameSite as CookieOptions['sameSite']) || 'lax' : 'lax',
    path: '/',
  };
};

export const COOKIE_EXPIRY = {
  ACCESS_TOKEN: 1 * 60 * 60 * 1000, // 1 hour
  ID_TOKEN: 1 * 60 * 60 * 1000, // 1 hour
  REFRESH_TOKEN: 8 * 60 * 60 * 1000, // 8 hours
  SESSION_TOKEN: 5 * 60 * 1000, // 5 minutes
  SCREEN_CONTEXT: 8 * 60 * 60 * 1000, // 8 hours
};

export interface AuthScreenContext {
  screenPermissions?: ScreenPermission[];
  authAttributes?: AuthAttribute[];
  mspinInfo?: Record<string, any> | null;
}

/**
 * Best Practice: Typed Cookie Setting
 * Ensures you can only set cookies we've defined in our constants
 */
export function setAuthCookie(res: Response, name: string, value: string, req?: Request): void {
  const maxAge = COOKIE_EXPIRY[name];
  const resolvedReq = resolveRequest(req, res);

  res.cookie(name, value, {
    ...buildBaseCookieOptions(resolvedReq),
    maxAge,
  });
}

export function setScreenContextCookie(res: Response, screenContext: AuthScreenContext | null, req?: Request): void {
  setAuthCookie(res, AUTH_COOKIES.SCREEN_CONTEXT, JSON.stringify(screenContext ?? null), req);
}

export function getTokenFromCookie(req: Request, tokenKey: string): string | undefined {
  return req.cookies?.[tokenKey];
}
/**
 * Clears a specific cookie based on the AUTH_COOKIES key
 */
export function clearCookieByName(res: Response, tokenKey: string, req?: Request): void {
  const resolvedReq = resolveRequest(req, res);
  res.clearCookie(tokenKey, buildBaseCookieOptions(resolvedReq));
}
/**
 * Optimized Clearing
 * Clears all auth-related cookies in one call
 */
export function clearAuthCookies(res: Response, req?: Request): void {
  const resolvedReq = resolveRequest(req, res);
  const baseCookieOptions = buildBaseCookieOptions(resolvedReq);
  Object.values(AUTH_COOKIES).forEach((cookieName) => {
    // When clearing, options (path, domain) must match the original set options
    res.clearCookie(cookieName, baseCookieOptions);
  });
}
