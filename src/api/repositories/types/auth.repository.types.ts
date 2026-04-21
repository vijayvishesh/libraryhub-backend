import { AuthUserRole } from '../../../types/jwtToken.types';

export type AuthOwnerRecord = {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  password: string;
  hasCreatedLibrary: boolean;
  role: AuthUserRole;
};

export type AuthTenantRecord = {
  id: string;
  name: string;
  ownerId: string;
  city: string;
  isSetupCompleted: boolean;
};

export type CreateTenantInput = {
  name: string;
  city: string;
  isSetupCompleted: boolean;
  ownerId: string;
};

export type CreateOwnerInput = {
  tenantId: string;
  name: string;
  phone: string;
  password: string;
  hasCreatedLibrary: boolean;
  role: AuthUserRole;
};

export type StudentRecord = {
  id: string;
  name: string;
  phone: string;
  gender: 'male' | 'female' | 'other';
  password: string;
  isPhoneVerified: boolean;
  hasJoinedLibrary: boolean;
  role: AuthUserRole;
};

export type CreateStudentInput = {
  name: string;
  phone: string;
  gender: 'male' | 'female' | 'other';
  password: string;
  isPhoneVerified: boolean;
  hasJoinedLibrary: boolean;
  role: AuthUserRole;
};

export type PendingOwnerSignupRecord = {
  id: string;
  name: string;
  phone: string;
  password: string;
  libraryName: string;
  city: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertPendingOwnerSignupInput = {
  name: string;
  phone: string;
  password: string;
  libraryName: string;
  city: string;
  otp: string;
  expiresAt: Date;
};

export type PendingStudentSignupRecord = {
  id: string;
  name: string;
  phone: string;
  gender: 'male' | 'female' | 'other';
  password: string;
  otp: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertPendingStudentSignupInput = {
  name: string;
  phone: string;
  gender: 'male' | 'female' | 'other';
  password: string;
  otp: string;
  expiresAt: Date;
};

export type AuthSessionRecord = {
  id: string;
  ownerId: string;
  tenantId: string;
  role: AuthUserRole;
  refreshTokenHash: string;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
};

export type CreateAuthSessionInput = {
  ownerId: string;
  tenantId: string;
  role: AuthUserRole;
  refreshTokenHash: string;
  expiresAt: Date;
};

export type RotateAuthSessionRefreshTokenInput = {
  sessionId: string;
  refreshTokenHash: string;
  expiresAt: Date;
};
