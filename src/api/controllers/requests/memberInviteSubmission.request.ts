import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const GENDER_ENUM = ['male', 'female', 'other'] as const;
const STATUS_ENUM = ['pending', 'approved', 'rejected'] as const;

// Simplified invite form — only these 6 fields
export class SubmitInviteFormRequest {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid mobile number' })
  mobileNo!: string;

  @IsString()
  @IsIn([...GENDER_ENUM])
  gender!: (typeof GENDER_ENUM)[number];

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  seatId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  slotId?: string;
}

// Owner list query
export class ListSubmissionsQueryRequest {
  @IsOptional()
  @IsString()
  @IsIn([...STATUS_ENUM])
  status?: (typeof STATUS_ENUM)[number];

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
}

// Owner edit a pending submission
export class UpdateSubmissionRequest {
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
  @IsIn([...GENDER_ENUM])
  gender?: (typeof GENDER_ENUM)[number];

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
  seatId?: string;

  @IsOptional()
  @IsString()
  slotId?: string;
}

// Approve / reject single
export class ReviewSubmissionRequest {
  @IsString()
  @IsIn(['approved', 'rejected'])
  action!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

// Bulk approve / reject selected IDs
export class BulkReviewRequest {
  @IsString({ each: true })
  ids!: string[];

  @IsString()
  @IsIn(['approved', 'rejected'])
  action!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
