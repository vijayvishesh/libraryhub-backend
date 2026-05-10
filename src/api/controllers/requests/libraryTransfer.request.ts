import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

const PHONE_REGEX = /^(?:\+91)?[6-9][0-9]{9}$/;

export class TransferNewOwnerRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(PHONE_REGEX, { message: 'phone must be a valid Indian mobile number' })
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class TransferLibrarySettingsRequest {
  @IsBoolean()
  keep_library_name!: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  new_library_name?: string;

  @IsBoolean()
  notify_students!: boolean;
}

export class InitiateLibraryTransferRequest {
  @IsString()
  @IsNotEmpty()
  library_id!: string;

  @ValidateNested()
  @Type(() => TransferNewOwnerRequest)
  new_owner!: TransferNewOwnerRequest;

  @ValidateNested()
  @Type(() => TransferLibrarySettingsRequest)
  library_settings!: TransferLibrarySettingsRequest;
}

export class VerifyLibraryTransferOtpRequest {
  @IsString()
  @IsNotEmpty()
  library_id!: string;

  @IsString()
  @Matches(/^[0-9]{4,6}$/, { message: 'old_owner_otp must be 4-6 digits' })
  old_owner_otp!: string;

  @IsString()
  @Matches(/^[0-9]{4,6}$/, { message: 'new_owner_otp must be 4-6 digits' })
  new_owner_otp!: string;
}