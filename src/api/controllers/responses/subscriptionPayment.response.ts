import { IsNumber, IsString, IsOptional } from 'class-validator';

export class SubscriptionOrderData {
  @IsString() paymentId!: string;       // your internal payment record id
  @IsString() razorpayOrderId!: string;
  @IsString() razorpayKeyId!: string;   // frontend needs this to init checkout
  @IsNumber() amount!: number;          // INR
  @IsString() currency!: string;
  @IsString() planName!: string;
  @IsString() receipt!: string;

  constructor(params?: {
    paymentId:       string;
    razorpayOrderId: string;
    razorpayKeyId:   string;
    amount:          number;
    currency:        string;
    planName:        string;
    receipt:         string;
  }) {
    if (!params) return;
    this.paymentId       = params.paymentId;
    this.razorpayOrderId = params.razorpayOrderId;
    this.razorpayKeyId   = params.razorpayKeyId;
    this.amount          = params.amount;
    this.currency        = params.currency;
    this.planName        = params.planName;
    this.receipt         = params.receipt;
  }
}

export class SubscriptionOrderApiResponse {
  @IsNumber() responseCode!: number;
  data!: SubscriptionOrderData;

  constructor(data?: SubscriptionOrderData, responseCode = 201) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data         = data;
  }
}

export class SubscriptionActivatedData {
  @IsString() subscriptionId!: string;
  @IsString() libraryId!: string;
  @IsString() planName!: string;
  @IsString() status!: string;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
  @IsNumber() daysRemaining!: number;
  @IsString() paymentId!: string;
  @IsString() message!: string;

  constructor(params?: {
    subscriptionId: string;
    libraryId:      string;
    planName:       string;
    status:         string;
    startDate:      string;
    endDate:        string;
    daysRemaining:  number;
    paymentId:      string;
    message:        string;
  }) {
    if (!params) return;
    this.subscriptionId = params.subscriptionId;
    this.libraryId      = params.libraryId;
    this.planName       = params.planName;
    this.status         = params.status;
    this.startDate      = params.startDate;
    this.endDate        = params.endDate;
    this.daysRemaining  = params.daysRemaining;
    this.paymentId      = params.paymentId;
    this.message        = params.message;
  }
}

export class SubscriptionActivatedApiResponse {
  @IsNumber() responseCode!: number;
  data!: SubscriptionActivatedData;

  constructor(data?: SubscriptionActivatedData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data         = data;
  }
}

export class PaymentHistoryItemData {
  @IsString()           id!: string;
  @IsString()           planName!: string;
  @IsNumber()           amount!: number;
  @IsString()           status!: string;
  @IsString()           razorpayOrderId!: string;
  @IsOptional()
  @IsString()           razorpayPaymentId?: string | null;
  @IsOptional()
  @IsString()           subscriptionId?: string | null;
  @IsString()           createdAt!: string;

  constructor(params?: {
    id:                string;
    planName:          string;
    amount:            number;
    status:            string;
    razorpayOrderId:   string;
    razorpayPaymentId: string | null;
    subscriptionId:    string | null;
    createdAt:         Date;
  }) {
    if (!params) return;
    this.id                = params.id;
    this.planName          = params.planName;
    this.amount            = params.amount;
    this.status            = params.status;
    this.razorpayOrderId   = params.razorpayOrderId;
    this.razorpayPaymentId = params.razorpayPaymentId;
    this.subscriptionId    = params.subscriptionId;
    this.createdAt         = params.createdAt.toISOString();
  }
}

export class PaymentHistoryApiResponse {
  @IsNumber() responseCode!: number;
  data!: {
    payments: PaymentHistoryItemData[];
    total:    number;
    page:     number;
    limit:    number;
  };

  constructor(
    payments?: PaymentHistoryItemData[],
    total?:    number,
    page?:     number,
    limit?:    number,
    responseCode = 200,
  ) {
    if (!payments || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = {
      payments,
      total:  total  ?? 0,
      page:   page   ?? 1,
      limit:  limit  ?? 20,
    };
  }
}

export class SubscriptionHistoryApiResponse {
  @IsNumber() responseCode!: number;
  data!: {
    subscriptions: any[];
    total:         number;
    page:          number;
    limit:         number;
  };

  constructor(
    subscriptions?: any[],
    total?:         number,
    page?:          number,
    limit?:         number,
    responseCode = 200,
  ) {
    if (!subscriptions || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = { subscriptions, total: total ?? 0, page: page ?? 1, limit: limit ?? 20 };
  }
}