import { Request, Response } from 'express';
import {
  AUTH_COOKIES,
  type AuthScreenContext,
  clearCookieByName,
  setAuthCookie,
  setScreenContextCookie,
} from './cookie.helper';

export function setAuthTokensInCookies(
  res: Response,
  req: Request | undefined,
  tokens: { refreshToken: string; accessToken: string; idToken: string },
  screenContext: AuthScreenContext | null,
  clearSessionToken = false,
): void {
  if (clearSessionToken) {
    clearCookieByName(res, AUTH_COOKIES.SESSION_TOKEN, req);
  }

  setAuthCookie(res, AUTH_COOKIES.REFRESH_TOKEN, tokens.refreshToken, req);
  setAuthCookie(res, AUTH_COOKIES.ACCESS_TOKEN, tokens.accessToken, req);
  setAuthCookie(res, AUTH_COOKIES.ID_TOKEN, tokens.idToken, req);
  setScreenContextCookie(res, screenContext, req);
}
