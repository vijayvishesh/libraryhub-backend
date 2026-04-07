export type TokenKeyType = 'id' | 'refresh' | 'session';

const TOKEN_NAMESPACE = 'token';

export const buildTokenKey = (type: TokenKeyType, token: string): string => `${TOKEN_NAMESPACE}:${type}:${token}`;

export const getTokenKeyCandidates = (type: TokenKeyType, token?: string | null): string[] => {
  if (!token) {
    return [];
  }
  return [buildTokenKey(type, token), token];
};
