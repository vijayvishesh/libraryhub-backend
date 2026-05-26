import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class UpdatePaymentMethodItemRequest {
  @IsString()
  @IsIn(['cash', 'qr_code'])
  type!: 'cash' | 'qr_code';

  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;
}

export class UpdatePaymentMethodsRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePaymentMethodItemRequest)
  methods!: UpdatePaymentMethodItemRequest[];
}