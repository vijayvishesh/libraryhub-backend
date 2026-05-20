import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

// add this
export class PaymentMethodData {
  @IsString()
  type!: string;

  enabled!: boolean;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  upiId?: string | null;

  constructor(data?: any) {
    if (!data) {
      return;
    }

    this.type = data.type;
    this.enabled = data.enabled;
    this.label = data.label;
    this.upiId = data.upiId;
  }
}

export class PaymentData {
  @IsString()
  id!: string;

  @IsString()
  userId!: string;

  @IsString()
  libraryId!: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsString()
  orderId!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;

  @IsString()
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsString()
  paymentStatus!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  paymentMethods?: PaymentMethodData[];

  @IsString()
  createdAt!: string;

  @IsString()
  updatedAt!: string;

  constructor(params?: {
    id: string;
    userId: string;
    libraryId: string;
    bookingId?: string;
    orderId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    transactionId?: string;
    paymentStatus: string;
    description?: string;
    metadata?: Record<string, unknown>;
    paymentMethods?: any[];
    createdAt: Date;
    updatedAt: Date;
  }) {
    if (!params) {
      return;
    }
    this.id = params.id;
    this.userId = params.userId;
    this.libraryId = params.libraryId;
    this.bookingId = params.bookingId;
    this.orderId = params.orderId;
    this.amount = params.amount;
    this.currency = params.currency;
    this.paymentMethod = params.paymentMethod;
    this.transactionId = params.transactionId;
    this.paymentStatus = params.paymentStatus;
    this.description = params.description;
    this.metadata = params.metadata;
    this.paymentMethods = params.paymentMethods?.map((p: any) => new PaymentMethodData(p));
    this.createdAt = params.createdAt.toISOString();
    this.updatedAt = params.updatedAt.toISOString();
  }
}

export class PaymentApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => PaymentData)
  data!: PaymentData;

  constructor(data?: PaymentData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class PaymentPaginationMeta {
  @IsNumber() page!: number;
  @IsNumber() limit!: number;
  @IsNumber() total!: number;
  @IsNumber() totalPages!: number;
  @IsBoolean() hasNext!: boolean;
  @IsBoolean() hasPrev!: boolean;

  constructor(page: number, limit: number, total: number) {
    this.page = page;
    this.limit = limit;
    this.total = total;
    const safeLimit = Math.max(limit, 1);
    this.totalPages = Math.max(1, Math.ceil(total / safeLimit));
    this.hasNext = page < this.totalPages;
    this.hasPrev = page > 1;
  }
}

export class ListPaymentsData {
  @ValidateNested({ each: true })
  @Type(() => PaymentData)
  payments!: PaymentData[];

  @ValidateNested()
  @Type(() => PaymentPaginationMeta)
  meta!: PaymentPaginationMeta;

  constructor(payments: PaymentData[], meta: PaymentPaginationMeta) {
    this.payments = payments;
    this.meta = meta;
  }
}

export class ListPaymentsApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => ListPaymentsData)
  data!: ListPaymentsData;

  constructor(payments?: PaymentData[], meta?: PaymentPaginationMeta, responseCode = 200) {
    if (!payments || !meta || typeof responseCode !== 'number') {
      return;
    }
    this.responseCode = responseCode;
    this.data = new ListPaymentsData(payments, meta);
  }
}

export class RazorpayOrderData {
  @IsString() orderId!: string;
  @IsNumber() amount!: number;
  @IsString() currency!: string;
  @IsString() keyId!: string;

  constructor(orderId: string, amount: number, currency: string, keyId: string) {
    this.orderId = orderId;
    this.amount = amount;
    this.currency = currency;
    this.keyId = keyId;
  }
}

export class RazorpayOrderApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested() @Type(() => RazorpayOrderData) data!: RazorpayOrderData;

  constructor(data?: RazorpayOrderData, responseCode = 200) {
    if (!data) {
      return;
    }
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class DeletePaymentApiResponse {
  @IsNumber() responseCode!: number;
  data!: { deleted: boolean };

  constructor(deleted: boolean, responseCode = 200) {
    this.responseCode = responseCode;
    this.data = { deleted };
  }
}
