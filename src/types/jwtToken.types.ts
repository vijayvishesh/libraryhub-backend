export type AuthUserRole = 'OWNER' | 'STUDENT';
export type AuthTokenType = 'access' | 'refresh';
export type AuthUserGender = 'male' | 'female' | 'other';

export type AuthJwtPayload = {
  sub: string;
  tid: string;
  sid: string;
  name: string;
  phone: string;
  gender: AuthUserGender;
  role: AuthUserRole;
  type: AuthTokenType;
};
