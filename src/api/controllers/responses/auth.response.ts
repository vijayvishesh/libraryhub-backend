import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
export { ErrorData } from './common.reponse';

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 60;

const toOpenApiRole = (role: string): string => {
  const normalizedRole = role.trim().toUpperCase();
  if (normalizedRole === 'OWNER') {
    return 'owner';
  }

  if (normalizedRole === 'STUDENT') {
    return 'student';
  }

  return normalizedRole.toLowerCase();
};

const toE164IndianPhone = (phone: string): string => {
  const trimmedPhone = phone.trim();
  if (trimmedPhone.startsWith('+')) {
    return trimmedPhone;
  }

  return `+91${trimmedPhone}`;
};

export class AuthUserData {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  phone!: string;

  @IsString()
  role!: string;

  @IsOptional()
  @IsBoolean()
  hasCreatedLibrary?: boolean;

  @IsOptional()
  @IsBoolean()
  hasJoinedLibrary?: boolean;

  constructor(
    id: string,
    name: string,
    phone: string,
    role: string,
    statusFlags?: {
      hasCreatedLibrary?: boolean;
      hasJoinedLibrary?: boolean;
    },
  ) {
    this.id = id;
    this.name = name;
    this.phone = phone;
    this.role = role;

    if (typeof statusFlags?.hasCreatedLibrary === 'boolean') {
      this.hasCreatedLibrary = statusFlags.hasCreatedLibrary;
    }

    if (typeof statusFlags?.hasJoinedLibrary === 'boolean') {
      this.hasJoinedLibrary = statusFlags.hasJoinedLibrary;
    }
  }
}

export class AuthTenantData {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  city!: string;

  @IsBoolean()
  isSetupCompleted!: boolean;

  constructor(id: string, name: string, city: string, isSetupCompleted: boolean) {
    this.id = id;
    this.name = name;
    this.city = city;
    this.isSetupCompleted = isSetupCompleted;
  }
}

export class AuthData {
  @IsString()
  accessToken!: string;

  @IsString()
  refreshToken!: string;

  @ValidateNested()
  @Type(() => AuthUserData)
  user!: AuthUserData;

  @IsOptional()
  @ValidateNested()
  @Type(() => AuthTenantData)
  tenant?: AuthTenantData;

  constructor(
    accessToken: string,
    refreshToken: string,
    user: AuthUserData,
    tenant?: AuthTenantData,
  ) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.user = user;

    if (tenant) {
      this.tenant = tenant;
    }
  }
}

export class TokenPairData {
  @IsString()
  accessToken!: string;

  @IsString()
  refreshToken!: string;

  @IsNumber()
  expiresIn!: number;

  constructor(
    accessToken: string,
    refreshToken: string,
    expiresIn = DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  ) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresIn = expiresIn;
  }
}

export class UserProfileData {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  phone!: string;

  @IsString()
  role!: string;

  @IsBoolean()
  isVerified!: boolean;

  @IsOptional()
  @IsBoolean()
  hasCreatedLibrary?: boolean;

  @IsOptional()
  @IsBoolean()
  hasJoinedLibrary?: boolean;

  @IsOptional()
  @IsString()
  createdAt?: string;

  constructor(user?: AuthUserData, createdAt?: Date) {
    if (!user) {
      return;
    }

    this.id = user.id;
    this.name = user.name;
    this.phone = toE164IndianPhone(user.phone);
    this.role = toOpenApiRole(user.role);
    this.isVerified = true;

    if (typeof user.hasCreatedLibrary === 'boolean') {
      this.hasCreatedLibrary = user.hasCreatedLibrary;
    }

    if (typeof user.hasJoinedLibrary === 'boolean') {
      this.hasJoinedLibrary = user.hasJoinedLibrary;
    }

    if (createdAt) {
      this.createdAt = createdAt.toISOString();
    }
  }
}

export class AuthRegisterData {
  @IsString()
  message!: string;

  @IsString()
  userId!: string;

  constructor(message: string, userId: string) {
    this.message = message;
    this.userId = userId;
  }
}

export class AuthRegisterApiResponse {
  @IsBoolean()
  success!: boolean;

  @IsString()
  message!: string;

  @IsString()
  userId!: string;

  constructor(data?: AuthRegisterData) {
    if (!data) {
      return;
    }

    this.success = true;
    this.message = data.message;
    this.userId = data.userId;
  }
}

export class AuthApiResponse {
  @IsBoolean()
  success!: boolean;

  @ValidateNested()
  @Type(() => TokenPairData)
  tokens!: TokenPairData;

  @ValidateNested()
  @Type(() => UserProfileData)
  user!: UserProfileData;

  constructor(data?: AuthData) {
    if (!data) {
      return;
    }

    this.success = true;
    this.tokens = new TokenPairData(data.accessToken, data.refreshToken);
    this.user = new UserProfileData(data.user);
  }
}

export class CurrentSessionData {
  @ValidateNested()
  @Type(() => AuthUserData)
  user!: AuthUserData;

  @IsOptional()
  @ValidateNested()
  @Type(() => AuthTenantData)
  tenant?: AuthTenantData;

  constructor(user: AuthUserData, tenant?: AuthTenantData) {
    this.user = user;

    if (tenant) {
      this.tenant = tenant;
    }
  }
}

export class CurrentSessionApiResponse {
  @IsBoolean()
  success!: boolean;

  @ValidateNested()
  @Type(() => UserProfileData)
  user!: UserProfileData;

  constructor(data?: CurrentSessionData) {
    if (!data) {
      return;
    }

    this.success = true;
    this.user = new UserProfileData(data.user);
  }
}

export class OtpActionData {
  @IsString()
  phone!: string;

  @IsString()
  message!: string;

  @IsBoolean()
  isVerified!: boolean;

  @IsOptional()
  @IsString()
  userId?: string;

  constructor(phone: string, message: string, isVerified: boolean, userId?: string) {
    this.phone = phone;
    this.message = message;
    this.isVerified = isVerified;

    if (userId) {
      this.userId = userId;
    }
  }
}

export class OtpActionApiResponse {
  @IsBoolean()
  success!: boolean;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  constructor(data?: OtpActionData) {
    if (!data) {
      return;
    }

    this.success = true;
    this.message = data.message;

    if (data.userId) {
      this.userId = data.userId;
    }
  }
}

export class OtpSendApiResponse {
  @IsBoolean()
  success!: boolean;

  @IsNumber()
  expiresIn!: number;

  constructor(expiresIn: number) {
    this.success = true;
    this.expiresIn = expiresIn;
  }
}

export class SessionTokenData {
  @IsString()
  accessToken!: string;

  @IsString()
  refreshToken!: string;

  constructor(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}

export class SessionTokenApiResponse {
  @ValidateNested()
  @Type(() => TokenPairData)
  tokens!: TokenPairData;

  constructor(data?: SessionTokenData) {
    if (!data) {
      return;
    }

    this.tokens = new TokenPairData(data.accessToken, data.refreshToken);
  }
}

export class LogoutData {
  @IsString()
  message!: string;

  constructor(message: string) {
    this.message = message;
  }
}

export class LogoutApiResponse {
  @IsBoolean()
  success!: boolean;

  @IsString()
  message!: string;

  constructor(data?: LogoutData) {
    if (!data) {
      return;
    }

    this.success = true;
    this.message = data.message;
  }
}
