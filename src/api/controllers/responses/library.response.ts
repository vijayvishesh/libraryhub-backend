import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class LibraryLocationData {
  @IsString()
  type!: 'Point';

  @IsArray()
  @IsNumber({}, { each: true })
  coordinates!: [number, number];

  constructor(type: 'Point', coordinates: [number, number]) {
    this.type = type;
    this.coordinates = coordinates;
  }
}

export class LibrarySlotData {
  @IsString()
  slotType!: string;

  @IsString()
  name!: string;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsNumber()
  pricePerMonth!: number;

  @IsBoolean()
  isActive!: boolean;

  constructor(
    slotType: string,
    name: string,
    startTime: string,
    endTime: string,
    pricePerMonth: number,
    isActive: boolean,
  ) {
    this.slotType = slotType;
    this.name = name;
    this.startTime = startTime;
    this.endTime = endTime;
    this.pricePerMonth = pricePerMonth;
    this.isActive = isActive;
  }
}

export class LibrarySeatingRangeData {
  @IsNumber()
  from!: number;

  @IsNumber()
  to!: number;

  @IsString()
  gender!: string;

  constructor(from: number, to: number, gender: string) {
    this.from = from;
    this.to = to;
    this.gender = gender;
  }
}

export class LibrarySeatingSectionData {
  @IsNumber()
  id!: number;

  @IsString()
  name!: string;

  @IsNumber()
  capacity!: number;

  @IsNumber()
  filled!: number;

  @IsNumber()
  available!: number;

  @IsString()
  gender!: string;

  constructor(
    id: number,
    name: string,
    capacity: number,
    filled: number,
    available: number,
    gender: string,
  ) {
    this.id = id;
    this.name = name;
    this.capacity = capacity;
    this.filled = filled;
    this.available = available;
    this.gender = gender;
  }
}

export class LibrarySeatingData {
  @IsString()
  mode!: string;

  @IsNumber()
  total!: number;

  @IsNumber()
  filled!: number;

  @IsNumber()
  available!: number;

  @IsOptional()
  @IsString()
  arrangement?: string;

  @IsOptional()
  @IsNumber()
  boys?: number;

  @IsOptional()
  @IsNumber()
  girls?: number;

  @IsOptional()
  @IsNumber()
  open?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibrarySeatingRangeData)
  ranges?: LibrarySeatingRangeData[];

  @IsOptional()
  @IsString()
  genderMode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibrarySeatingSectionData)
  sections?: LibrarySeatingSectionData[];

  constructor(params?: {
    mode: string;
    total: number;
    filled: number;
    available: number;
    arrangement?: string;
    boys?: number;
    girls?: number;
    open?: number;
    ranges?: LibrarySeatingRangeData[];
    genderMode?: string;
    sections?: LibrarySeatingSectionData[];
  }) {
    if (!params) {
      return;
    }

    this.mode = params.mode;
    this.total = params.total;
    this.filled = params.filled;
    this.available = params.available;
    this.arrangement = params.arrangement;
    this.boys = params.boys;
    this.girls = params.girls;
    this.open = params.open;
    this.ranges = params.ranges;
    this.genderMode = params.genderMode;
    this.sections = params.sections;
  }
}

export class LibraryPhotoData {
  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsNumber()
  order!: number;

  @IsString()
  uploadedAt!: string;

  constructor(url: string, publicId: string | null, order: number, uploadedAt: Date) {
    this.url = url;
    this.publicId = publicId ?? undefined;
    this.order = order;
    this.uploadedAt = uploadedAt.toISOString();
  }
}

export class LibraryStatsData {
  @IsNumber()
  totalMembers!: number;

  @IsNumber()
  activeMembers!: number;

  @IsNumber()
  rating!: number;

  @IsNumber()
  reviewCount!: number;

  constructor(totalMembers: number, activeMembers: number, rating: number, reviewCount: number) {
    this.totalMembers = totalMembers;
    this.activeMembers = activeMembers;
    this.rating = rating;
    this.reviewCount = reviewCount;
  }
}

export class LibraryPaymentMethodData {
  @IsString()
  type!: string;

  @IsBoolean()
  enabled!: boolean;

  @IsString()
  label!: string;

  constructor(type: string, enabled: boolean, label: string) {
    this.type = type;
    this.enabled = enabled;
    this.label = label;
  }
}

export class LibrarySetupData {
  @IsString()
  id!: string;

  @IsString()
  ownerId!: string;

  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsString()
  contactPhone!: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsString()
  address!: string;

  @IsString()
  city!: string;

  @IsString()
  state!: string;

  @IsString()
  pincode!: string;

  @ValidateNested()
  @Type(() => LibraryLocationData)
  location!: LibraryLocationData;

  @IsNumber()
  totalSeats!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => LibrarySeatingData)
  seating?: LibrarySeatingData;

  @IsArray()
  @IsString({ each: true })
  facilities!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibrarySlotData)
  slots!: LibrarySlotData[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibraryPhotoData)
  photos!: LibraryPhotoData[];

  @IsBoolean()
  isActive!: boolean;

  @IsBoolean()
  isMarketplaceVisible!: boolean;

  @IsBoolean()
  isOpen!: boolean;

  @IsString()
  openingHours!: string;

  @ValidateNested()
  @Type(() => LibraryStatsData)
  stats!: LibraryStatsData;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibraryPaymentMethodData)
  paymentMethods!: LibraryPaymentMethodData[];

  @IsOptional()
  @IsString()
  deletedAt?: string;

  @IsString()
  createdAt!: string;

  @IsString()
  updatedAt!: string;

  constructor(params?: {
    id: string;
    ownerId: string;
    name: string;
    description: string;
    contactPhone: string;
    contactEmail: string | null;
    address: string;
    city: string;
    state: string;
    pincode: string;
    location: LibraryLocationData;
    totalSeats: number;
    seating?: LibrarySeatingData;
    facilities: string[];
    slots: LibrarySlotData[];
    photos: LibraryPhotoData[];
    isActive: boolean;
    isMarketplaceVisible: boolean;
    isOpen: boolean;
    openingHours: string;
    stats: LibraryStatsData;
    paymentMethods: LibraryPaymentMethodData[];
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    if (!params) {
      return;
    }

    this.id = params.id;
    this.ownerId = params.ownerId;
    this.name = params.name;
    this.description = params.description;
    this.contactPhone = params.contactPhone;
    this.contactEmail = params.contactEmail ?? undefined;
    this.address = params.address;
    this.city = params.city;
    this.state = params.state;
    this.pincode = params.pincode;
    this.location = params.location;
    this.totalSeats = params.totalSeats;
    this.seating = params.seating;
    this.facilities = params.facilities;
    this.slots = params.slots;
    this.photos = params.photos;
    this.isActive = params.isActive;
    this.isMarketplaceVisible = params.isMarketplaceVisible;
    this.isOpen = params.isOpen;
    this.openingHours = params.openingHours;
    this.stats = params.stats;
    this.paymentMethods = params.paymentMethods;
    this.deletedAt = params.deletedAt ? params.deletedAt.toISOString() : undefined;
    this.createdAt = params.createdAt.toISOString();
    this.updatedAt = params.updatedAt.toISOString();
  }
}

export class LibrarySetupApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => LibrarySetupData)
  data!: LibrarySetupData;

  constructor(data?: LibrarySetupData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}

export class PaginationMetaData {
  @IsNumber()
  page!: number;

  @IsNumber()
  limit!: number;

  @IsNumber()
  total!: number;

  @IsNumber()
  totalPages!: number;

  @IsBoolean()
  hasNext!: boolean;

  @IsBoolean()
  hasPrev!: boolean;

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

export class ListedLibrariesData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibrarySetupData)
  libraries!: LibrarySetupData[];

  @ValidateNested()
  @Type(() => PaginationMetaData)
  meta!: PaginationMetaData;

  constructor(libraries: LibrarySetupData[], meta: PaginationMetaData) {
    this.libraries = libraries;
    this.meta = meta;
  }
}

export class ListedLibrariesApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => ListedLibrariesData)
  data!: ListedLibrariesData;

  constructor(libraries?: LibrarySetupData[], meta?: PaginationMetaData, responseCode = 200) {
    if (!libraries || !meta || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = new ListedLibrariesData(libraries, meta);
  }
}
