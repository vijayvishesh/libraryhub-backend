import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  Max,
  IsIn,
  IsDateString,
} from 'class-validator';

// Step 1 — Owner selects plan, creates Razorpay order
export class CreateSubscriptionOrderRequest {
  @IsString()
  @IsNotEmpty()
  libraryId!: string;

  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  durationMonths?: number; // for future multi-month support, default 1

  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  startDate?: string;
}

// Step 2 — Frontend sends payment result for verification
export class VerifySubscriptionPaymentRequest {
  @IsString()
  @IsNotEmpty()
  razorpayOrderId!: string;

  @IsString()
  @IsNotEmpty()
  razorpayPaymentId!: string;

  @IsString()
  @IsNotEmpty()
  razorpaySignature!: string;

  @IsString()
  @IsNotEmpty()
  libraryId!: string;

  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  startDate?: string;
}

// Owner resend/retry failed payment — creates new order for same plan
export class RetrySubscriptionOrderRequest {
  @IsString()
  @IsNotEmpty()
  libraryId!: string;

  @IsString()
  @IsNotEmpty()
  planId!: string;
}

// History query
export class SubscriptionHistoryQueryRequest {
  @IsString()
  @IsNotEmpty()
  libraryId!: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'expired', 'cancelled', 'trial'])
  status?: 'active' | 'expired' | 'cancelled' | 'trial';

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