import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LIBRARY_FACILITY_ENUM,
  LIBRARY_PAYMENT_METHOD_ENUM,
  LIBRARY_SEATING_ARRANGEMENT_ENUM,
  LIBRARY_SEATING_GENDER_ENUM,
  LIBRARY_SEATING_GENDER_MODE_ENUM,
  LIBRARY_SEATING_MODE_ENUM,
  LIBRARY_SLOT_TYPE_ENUM,
} from '../../constants/library.constants';

const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class LibraryGeoLocationRequest {
  @IsString()
  @IsIn(['Point'])
  type!: 'Point';

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates!: [number, number];
}

export class LibraryGeoCoordinatesRequest {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}

export class LibrarySlotRequest {
  @IsString()
  @IsIn([...LIBRARY_SLOT_TYPE_ENUM])
  slotType!: (typeof LIBRARY_SLOT_TYPE_ENUM)[number];

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(TIME_FORMAT_REGEX, { message: 'startTime must be in HH:mm format' })
  startTime!: string;

  @IsString()
  @Matches(TIME_FORMAT_REGEX, { message: 'endTime must be in HH:mm format' })
  endTime!: string;

  @IsNumber()
  @Min(0)
  pricePerMonth!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class LibraryPhotoRequest {
  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}

export class LibrarySeatingRangeRequest {
  @IsNumber()
  @Min(0)
  from!: number;

  @IsNumber()
  @Min(0)
  to!: number;

  @IsString()
  @IsIn([...LIBRARY_SEATING_GENDER_ENUM])
  gender!: (typeof LIBRARY_SEATING_GENDER_ENUM)[number];
}

export class LibrarySeatingSectionRequest {
  @IsNumber()
  @Min(0)
  id!: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  capacity!: number;

  @IsNumber()
  @Min(0)
  filled!: number;

  @IsNumber()
  @Min(0)
  available!: number;

  @IsString()
  @IsIn([...LIBRARY_SEATING_GENDER_ENUM])
  gender!: (typeof LIBRARY_SEATING_GENDER_ENUM)[number];
}

export class LibrarySeatingRequest {
  @IsString()
  @IsIn([...LIBRARY_SEATING_MODE_ENUM])
  mode!: (typeof LIBRARY_SEATING_MODE_ENUM)[number];

  @IsNumber()
  @Min(0)
  total!: number;

  @IsNumber()
  @Min(0)
  filled!: number;

  @IsNumber()
  @Min(0)
  available!: number;

  @IsOptional()
  @IsString()
  @IsIn([...LIBRARY_SEATING_ARRANGEMENT_ENUM])
  arrangement?: (typeof LIBRARY_SEATING_ARRANGEMENT_ENUM)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  boys?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  girls?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  open?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibrarySeatingRangeRequest)
  ranges?: LibrarySeatingRangeRequest[];

  @IsOptional()
  @IsString()
  @IsIn([...LIBRARY_SEATING_GENDER_MODE_ENUM])
  genderMode?: (typeof LIBRARY_SEATING_GENDER_MODE_ENUM)[number];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibrarySeatingSectionRequest)
  sections?: LibrarySeatingSectionRequest[];
}

export class LibraryStatsRequest {
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalMembers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  activeMembers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reviewCount?: number;
}

export class LibraryPaymentMethodRequest {
  @IsString()
  @IsIn([...LIBRARY_PAYMENT_METHOD_ENUM])
  type!: (typeof LIBRARY_PAYMENT_METHOD_ENUM)[number];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;
}

export class LibrarySetupRequest {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'contactPhone must be a valid 10-digit number' })
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'ownerPhone must be a valid 10-digit number' })
  ownerPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'pincode must be a valid 6-digit number' })
  pincode?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LibraryGeoLocationRequest)
  location?: LibraryGeoLocationRequest;

  @IsOptional()
  @ValidateNested()
  @Type(() => LibraryGeoCoordinatesRequest)
  coordinates?: LibraryGeoCoordinatesRequest;

  @IsOptional()
  @IsNumber()
  @Min(1)
  totalSeats?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...LIBRARY_FACILITY_ENUM], { each: true })
  facilities?: (typeof LIBRARY_FACILITY_ENUM)[number][];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => LibrarySlotRequest)
  slots?: LibrarySlotRequest[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibraryPhotoRequest)
  photos?: LibraryPhotoRequest[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isMarketplaceVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsString()
  openingHours?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LibrarySeatingRequest)
  seating?: LibrarySeatingRequest;

  @IsOptional()
  @ValidateNested()
  @Type(() => LibraryStatsRequest)
  stats?: LibraryStatsRequest;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibraryPaymentMethodRequest)
  paymentMethods?: LibraryPaymentMethodRequest[];
}

export class LibraryListQueryRequest {
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

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  @IsIn([...LIBRARY_SEATING_GENDER_ENUM])
  gender?: string;
}

export class UpdateLibraryRequest {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'contactPhone must be a valid 10-digit number' })
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'pincode must be a valid 6-digit number' })
  pincode?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LibraryGeoLocationRequest)
  location?: LibraryGeoLocationRequest;

  @IsOptional()
  @ValidateNested()
  @Type(() => LibraryGeoCoordinatesRequest)
  coordinates?: LibraryGeoCoordinatesRequest;

  @IsOptional()
  @IsNumber()
  @Min(1)
  totalSeats?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...LIBRARY_FACILITY_ENUM], { each: true })
  facilities?: (typeof LIBRARY_FACILITY_ENUM)[number][];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => LibrarySlotRequest)
  slots?: LibrarySlotRequest[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibraryPhotoRequest)
  photos?: LibraryPhotoRequest[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isMarketplaceVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsString()
  openingHours?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LibrarySeatingRequest)
  seating?: LibrarySeatingRequest;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibraryPaymentMethodRequest)
  paymentMethods?: LibraryPaymentMethodRequest[];
}

export class LibrarySlotPlanRequest {
  @IsString()
  @IsNotEmpty()
  duration!: string;

  @IsBoolean()
  isActive!: boolean;

  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent!: number;
}

export class LibrarySlotTrialRequest {
  @IsString()
  @IsNotEmpty()
  duration!: string;

  @IsBoolean()
  isActive!: boolean;
}

export class UpdateLibrarySlotRequest {
  @IsString()
  @IsIn([...LIBRARY_SLOT_TYPE_ENUM])
  slotType!: (typeof LIBRARY_SLOT_TYPE_ENUM)[number];

  @IsBoolean()
  isActive!: boolean;

  @IsString()
  @Matches(TIME_FORMAT_REGEX, { message: 'startTime must be in HH:mm format' })
  startTime!: string;

  @IsString()
  @Matches(TIME_FORMAT_REGEX, { message: 'endTime must be in HH:mm format' })
  endTime!: string;

  @IsNumber()
  @Min(0)
  pricePerMonth!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibrarySlotPlanRequest)
  plans?: LibrarySlotPlanRequest[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibrarySlotTrialRequest)
  trials?: LibrarySlotTrialRequest[];
}

export class UpdateLibrarySlotsRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateLibrarySlotRequest)
  slots!: UpdateLibrarySlotRequest[];
}
