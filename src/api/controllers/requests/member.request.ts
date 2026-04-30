import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const MEMBER_STATUS_ENUM = ['active', 'inactive', 'expired', 'pending'] as const;

export class AddMemberRequest {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid mobile number' })
  mobileNo!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{12}$/, { message: 'Aadhar must be 12 digits' })
  aadharId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  seatId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slotId?: string;

  @IsOptional()
  @IsString()
  @IsIn([...MEMBER_STATUS_ENUM])
  status?: (typeof MEMBER_STATUS_ENUM)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  planAmount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMemberRequest {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid mobile number' })
  mobileNo?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{12}$/, { message: 'Aadhar must be 12 digits' })
  aadharId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  seatId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slotId?: string;

  @IsOptional()
  @IsString()
  @IsIn([...MEMBER_STATUS_ENUM])
  status?: (typeof MEMBER_STATUS_ENUM)[number];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  planAmount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListMembersQueryRequest {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn([...MEMBER_STATUS_ENUM])
  status?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slotId?: string;
}

const MEMBER_UPLOAD_STATUS_ENUM = ['success', 'partial_success', 'failed'] as const;

export class ListMemberUploadsQueryRequest {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @IsIn([...MEMBER_UPLOAD_STATUS_ENUM])
  status?: (typeof MEMBER_UPLOAD_STATUS_ENUM)[number];
}

export class GenerateMemberInviteLinkRequest {
  @IsString()
  @IsNotEmpty()
  siteLibraryId!: string;
}

export class SubmitMemberViaInviteLinkRequest {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid mobile number' })
  mobileNo!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{12}$/, { message: 'Aadhar must be 12 digits' })
  aadharId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  seatId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slotId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  planAmount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
