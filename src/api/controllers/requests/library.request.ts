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
import { LIBRARY_FACILITY_ENUM, LIBRARY_SLOT_TYPE_ENUM } from '../../constants/library.constants';

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
  @ArrayMaxSize(3)
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
  @Type(() => LibraryStatsRequest)
  stats?: LibraryStatsRequest;
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
}
