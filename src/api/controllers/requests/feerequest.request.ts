import {
  IsString,
  MinLength,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
  IsDateString,
  IsArray,
  IsIn,
  IsInt,
  // IsUrl,
} from 'class-validator';
import { FEE_REQUEST_REASON_ENUM, FEE_REQUEST_STATUS_ENUM } from '../../models/feerequest.model';

// ─── Send to single student ───────────────────────────────────────────────────

export class SendFeeRequestByStudentRequest {
  /** Member record ID (MemberModel _id) — owner sees this in their member list */
  @IsString()
  @MinLength(1)
  memberId!: string;             // ← was studentId

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @IsEnum(FEE_REQUEST_REASON_ENUM, {
    message: `reason must be one of: ${FEE_REQUEST_REASON_ENUM.join(', ')}`,
  })
  reason!: (typeof FEE_REQUEST_REASON_ENUM)[number];

  @IsOptional()
  @IsString()
  note?: string;

  /** ISO date string "YYYY-MM-DD" */
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

// ─── Bulk send to multiple students ──────────────────────────────────────────

export class SendBulkFeeRequestByStudentRequest {
  /** Array of student user IDs. ALL must have a member record or the entire request fails. */
  @IsArray()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  studentIds!: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @IsEnum(FEE_REQUEST_REASON_ENUM, {
    message: `reason must be one of: ${FEE_REQUEST_REASON_ENUM.join(', ')}`,
  })
  reason!: (typeof FEE_REQUEST_REASON_ENUM)[number];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

// ─── List / filter ────────────────────────────────────────────────────────────

export class ListFeeRequestsQueryRequest {
  /** Filter by student user ID (auto-resolved to memberId internally) */
  @IsOptional()
  @IsString()
  studentId?: string;

  /** Filter by member ID directly */
  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsIn(FEE_REQUEST_STATUS_ENUM)
  status?: string;

  @IsOptional()
  @IsIn(FEE_REQUEST_REASON_ENUM)
  reason?: string;

  /** Filter all requests belonging to a bulk send batch */
  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

// ─── Student: attach payment screenshot ──────────────────────────────────────

export class UploadPaymentScreenshotRequest {
  /**
   * Public URL returned by PATCH /api/v1/upload/
   * ?folder=payment-screenshots&feeRequestId=<id>
   */
  @IsString()
  @MinLength(1)
  screenshotUrl!: string;
}