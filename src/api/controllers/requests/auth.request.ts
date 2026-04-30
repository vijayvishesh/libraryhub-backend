import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const PHONE_REGEX = /^(?:\+91)?[6-9][0-9]{9}$/;
const USER_ROLE_ENUM = ['owner', 'student'] as const;
const USER_GENDER_ENUM = ['male', 'female', 'other'] as const;
const OTP_PURPOSE_ENUM = ['verify', 'login', 'reset'] as const;

export type AuthRequestRole = (typeof USER_ROLE_ENUM)[number];
export type AuthRequestGender = (typeof USER_GENDER_ENUM)[number];

export class RegisterRequest {
  @Transform(({ value, obj }: { value: unknown; obj?: { username?: unknown } }) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof obj?.username === 'string') {
      return obj.username.trim();
    }

    return value;
  })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @Transform(trimString)
  @IsNotEmpty()
  @Matches(PHONE_REGEX, {
    message: 'phone must be a valid Indian mobile number',
  })
  phone!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password!: string;

  @Transform(trimString)
  @IsNotEmpty()
  @IsIn([...USER_ROLE_ENUM])
  role!: AuthRequestRole;

  @Transform(trimString)
  @IsOptional()
  @IsIn([...USER_GENDER_ENUM])
  gender?: AuthRequestGender;
}

export class RegisterOwnerRequest {
  @Transform(({ value, obj }: { value: unknown; obj?: { name?: unknown } }) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof obj?.name === 'string') {
      return obj.name.trim();
    }

    return value;
  })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Transform(trimString)
  @IsNotEmpty()
  @Matches(PHONE_REGEX, {
    message: 'phone must be a valid Indian mobile number',
  })
  phone!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password!: string;
}

export class LoginRequest {
  @Transform(trimString)
  @IsNotEmpty()
  @Matches(PHONE_REGEX, {
    message: 'phone must be a valid Indian mobile number',
  })
  phone!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;

  @Transform(trimString)
  @IsNotEmpty()
  @IsIn([...USER_ROLE_ENUM])
  role!: AuthRequestRole;
}

export class SendOtpRequest {
  @Transform(trimString)
  @IsNotEmpty()
  @Matches(PHONE_REGEX, {
    message: 'phone must be a valid Indian mobile number',
  })
  phone!: string;

  @Transform(trimString)
  @IsOptional()
  @IsIn([...OTP_PURPOSE_ENUM])
  purpose?: (typeof OTP_PURPOSE_ENUM)[number];
}

export class VerifyOtpRequest {
  @Transform(trimString)
  @IsNotEmpty()
  @Matches(PHONE_REGEX, {
    message: 'phone must be a valid Indian mobile number',
  })
  phone!: string;

  @Transform(trimString)
  @IsNotEmpty()
  @Matches(/^[0-9]{4,6}$/, {
    message: 'otp must be a valid 4 to 6 digit number',
  })
  otp!: string;
}

export class VerifyOtpWithRoleRequest extends VerifyOtpRequest {
  @Transform(trimString)
  @IsNotEmpty()
  @IsIn([...USER_ROLE_ENUM])
  role!: AuthRequestRole;
}

export class RegisterStudentRequest {
  @Transform(({ value, obj }: { value: unknown; obj?: { name?: unknown } }) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (typeof obj?.name === 'string') {
      return obj.name.trim();
    }

    return value;
  })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Transform(trimString)
  @IsNotEmpty()
  @Matches(PHONE_REGEX, {
    message: 'phone must be a valid Indian mobile number',
  })
  phone!: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password!: string;
}

export class RefreshSessionRequest {
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  refreshToken!: string;
}

export class LogoutRequest {
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  refreshToken!: string;
}

export class UpdateProfileRequest {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Transform(trimString)
  @IsIn([...USER_GENDER_ENUM])
  gender?: AuthRequestGender;
}
