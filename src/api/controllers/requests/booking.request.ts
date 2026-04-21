import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  LIBRARY_PAYMENT_METHOD_ENUM,
  LIBRARY_SLOT_TYPE_ENUM,
} from '../../constants/library.constants';

export class CreateBookingRequest {
  @IsString()
  @IsNotEmpty()
  libraryId!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([...LIBRARY_SLOT_TYPE_ENUM])
  slotId!: (typeof LIBRARY_SLOT_TYPE_ENUM)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  seatId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sectionId?: string;

  @IsString()
  @IsIn([...LIBRARY_PAYMENT_METHOD_ENUM])
  paymentMethod!: (typeof LIBRARY_PAYMENT_METHOD_ENUM)[number];

  @IsOptional()
  @IsBoolean()
  autoAllocate?: boolean;

  @IsOptional()
  @IsString()
  @IsDateString(
    { strict: true, strictSeparator: true },
    { message: 'startDate must be a valid ISO date (YYYY-MM-DD)' },
  )
  startDate?: string;
}

export class ListMyBookingsQueryRequest {
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

export class LibrarySeatMapQueryRequest {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn([...LIBRARY_SLOT_TYPE_ENUM])
  slotId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sectionId?: string;
}
