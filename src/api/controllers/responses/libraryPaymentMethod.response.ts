import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class PaymentMethodData {
  @IsString()
  type!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  qrCodeUrl?: string | null;

  constructor(data?: {
    type: string;
    enabled: boolean;
    label: string;
    qrCodeUrl?: string | null;
  }) {
    if (!data) return;
    this.type = data.type;
    this.enabled = data.enabled;
    this.label = data.label;
    this.qrCodeUrl = data.qrCodeUrl ?? null;
  }
}

export class LibraryPaymentMethodsData {
  @IsString()
  libraryId!: string;

  @IsArray()
  methods!: PaymentMethodData[];

  constructor(data?: { libraryId: string; methods: PaymentMethodData[] }) {
    if (!data) return;
    this.libraryId = data.libraryId;
    this.methods = data.methods;
  }
}

export class LibraryPaymentMethodsApiResponse {
  @IsNumber()
  responseCode!: number;

  data!: LibraryPaymentMethodsData;

  constructor(data?: LibraryPaymentMethodsData, responseCode = 200) {
    if (!data) return;
    this.responseCode = responseCode;
    this.data = data;
  }
}