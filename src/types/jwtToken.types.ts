export type AuthUserRole = 'OWNER' | 'STUDENT';
export type AuthTokenType = 'access' | 'refresh';

export type AuthJwtPayload = {
  sub: string;
  tid: string;
  sid: string;
  role: AuthUserRole;
  type: AuthTokenType;
};
