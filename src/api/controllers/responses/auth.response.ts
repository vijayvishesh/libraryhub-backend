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
  gender!: 'male' | 'female' | 'other';

  @IsString()
  role!: string;

  @IsOptional()
  @IsBoolean()
  hasCreatedLibrary?: boolean;

  @IsOptional()
  @IsBoolean()
  hasJoinedLibrary?: boolean;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  bio?: string | null;

  constructor(
    id: string,
    name: string,
    phone: string,
    gender: 'male' | 'female' | 'other',
    role: string,
    statusFlags?: {
      hasCreatedLibrary?: boolean;
      hasJoinedLibrary?: boolean;
      email?: string | null;     
      city?: string | null;      
      bio?: string | null; 
    },
  ) {
    this.id = id;
    this.name = name;
    this.phone = phone;
    this.gender = gender;
    this.role = role;

    if (typeof statusFlags?.hasCreatedLibrary === 'boolean') {
      this.hasCreatedLibrary = statusFlags.hasCreatedLibrary;
    }

    if (typeof statusFlags?.hasJoinedLibrary === 'boolean') {
      this.hasJoinedLibrary = statusFlags.hasJoinedLibrary;
    }
    if (statusFlags?.email !== undefined) {
      this.email = statusFlags.email;
    }

    if (statusFlags?.city !== undefined) {
      this.city = statusFlags.city;
    }

    if (statusFlags?.bio !== undefined) {
      this.bio = statusFlags.bio;
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

  @IsString()
  gender!: 'male' | 'female' | 'other';

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

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  bio?: string | null;

  constructor(user?: AuthUserData, createdAt?: Date) {
    if (!user) {
      return;
    }

    this.id = user.id;
    this.name = user.name;
    this.phone = toE164IndianPhone(user.phone);
    this.role = toOpenApiRole(user.role);
    this.gender = user.gender;
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
    if (user.email !== undefined) this.email = user.email;
    if (user.city !== undefined) this.city = user.city;
    if (user.bio !== undefined) this.bio = user.bio;
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
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => AuthRegisterData)
  data!: AuthRegisterData;

  constructor(data?: AuthRegisterData, responseCode = 201) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}

export class AuthPayloadData {
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

    this.tokens = new TokenPairData(data.accessToken, data.refreshToken);
    this.user = new UserProfileData(data.user);
  }
}

export class AuthApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => AuthPayloadData)
  data!: AuthPayloadData;

  constructor(data?: AuthData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = new AuthPayloadData(data);
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

export class CurrentSessionPayloadData {
  @ValidateNested()
  @Type(() => UserProfileData)
  user!: UserProfileData;

  constructor(data?: CurrentSessionData) {
    if (!data) {
      return;
    }

    this.user = new UserProfileData(data.user);
  }
}

export class CurrentSessionApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => CurrentSessionPayloadData)
  data!: CurrentSessionPayloadData;

  constructor(data?: CurrentSessionData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = new CurrentSessionPayloadData(data);
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

export class OtpActionPayloadData {
  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  constructor(data?: OtpActionData) {
    if (!data) {
      return;
    }

    this.message = data.message;

    if (data.userId) {
      this.userId = data.userId;
    }
  }
}

export class OtpActionApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => OtpActionPayloadData)
  data!: OtpActionPayloadData;

  constructor(data?: OtpActionData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = new OtpActionPayloadData(data);
  }
}

export class OtpSendData {
  @IsNumber()
  expiresIn!: number;

  constructor(expiresIn: number) {
    this.expiresIn = expiresIn;
  }
}

export class OtpSendApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => OtpSendData)
  data!: OtpSendData;

  constructor(expiresIn?: number, responseCode = 200) {
    if (typeof expiresIn !== 'number' || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = new OtpSendData(expiresIn);
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

export class SessionTokenPayloadData {
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

export class SessionTokenApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => SessionTokenPayloadData)
  data!: SessionTokenPayloadData;

  constructor(data?: SessionTokenData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = new SessionTokenPayloadData(data);
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
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => LogoutData)
  data!: LogoutData;

  constructor(data?: LogoutData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}
