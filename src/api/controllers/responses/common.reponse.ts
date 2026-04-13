import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CommonResponse<T = unknown> {
  @IsBoolean()
  success!: boolean;

  @ValidateNested()
  data!: T | null;

  constructor(success: boolean, data: T | null = null) {
    this.success = success;
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
  @IsBoolean()
  success!: boolean;

  @IsString()
  code!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErrorData)
  details?: ErrorData[];

  constructor(code: string, message: string, details: ErrorData[] = []) {
    this.success = false;
    this.code = code;
    this.message = message;
    this.details = details;
  }
}
