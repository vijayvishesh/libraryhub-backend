import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { LIBRARY_PAYMENT_METHOD_ENUM } from '../../constants/library.constants';
import { PAYMENT_STATUS_ENUM } from '../../models/payment.model';

export class CreatePaymentRequest {
  @IsString()
  @IsNotEmpty()
  libraryId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bookingId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  idempotencyKey?: string;

  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  @IsIn([...LIBRARY_PAYMENT_METHOD_ENUM])
  paymentMethod!: (typeof LIBRARY_PAYMENT_METHOD_ENUM)[number];

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  @IsIn([...PAYMENT_STATUS_ENUM])
  paymentStatus?: (typeof PAYMENT_STATUS_ENUM)[number];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdatePaymentStatusRequest {
  @IsString()
  @IsNotEmpty()
  @IsIn([...PAYMENT_STATUS_ENUM])
  paymentStatus!: (typeof PAYMENT_STATUS_ENUM)[number];

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListPaymentsQueryRequest {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  libraryId?: string;

  @IsOptional()
  @IsString()
  @IsIn([...PAYMENT_STATUS_ENUM])
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  @IsIn([...LIBRARY_PAYMENT_METHOD_ENUM])
  paymentMethod?: string;

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

export class CreateRazorpayOrderRequest {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  receipt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bookingId?: string;
}

export class VerifyRazorpayPaymentRequest {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @IsString()
  @IsNotEmpty()
  signature!: string;
}
