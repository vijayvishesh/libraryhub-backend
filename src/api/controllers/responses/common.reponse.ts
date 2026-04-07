import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CommonResponse<T = unknown> {
  @IsNumber()
  status!: number;

  @ValidateNested()
  data!: T | null;

  @IsOptional()
  @IsString()
  error!: null;

  constructor(status: number, data: T | null = null) {
    this.status = status;
    this.data = data;
  }
}

export class ErrorResponseModel<T> {
  @IsNumber()
  status!: number;

  @IsOptional()
  data?: null;

  @IsString()
  error!: T | string | ErrorData[];

  constructor(status: number, error: string | null | ErrorData[] = null) {
    this.status = status;
    this.error = error;
    this.data = null;
  }
}

export class ErrorData {
  @IsString()
  errorCode!: string;

  @IsString()
  errorMessage!: string;
}
