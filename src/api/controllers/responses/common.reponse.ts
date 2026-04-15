import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CommonResponse<T = unknown> {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  data!: T | null;

  constructor(responseCode: number, data: T | null = null) {
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class ErrorData {
  @IsOptional()
  @IsString()
  field?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  errorCode?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  constructor(field?: string, message?: string) {
    this.field = field;
    this.message = message;
  }
}

export class ErrorResponseModel {
  @IsNumber()
  responseCode!: number;

  @IsString()
  message!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErrorData)
  data?: ErrorData[];

  constructor(responseCode?: number, message?: string, data: ErrorData[] = []) {
    if (typeof responseCode !== 'number' || typeof message !== 'string') {
      return;
    }

    this.responseCode = responseCode;
    this.message = message;
    this.data = data;
  }
}
