import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SeatMapSeatData {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @IsString()
  gender!: string;

  @IsBoolean()
  occupied!: boolean;

  @IsString()
  seatStatus!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  constructor(params?: {
    id: string;
    label: string;
    gender: string;
    occupied: boolean;
    seatStatus: string;
    sectionId: string | null;
  }) {
    if (!params) {
      return;
    }

    this.id = params.id;
    this.label = params.label;
    this.gender = params.gender;
    this.occupied = params.occupied;
    this.seatStatus = params.seatStatus;
    if (params.sectionId) {
      this.sectionId = params.sectionId;
    }
  }
}

export class SeatMapData {
  @IsString()
  libraryId!: string;

  @IsString()
  slotId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatMapSeatData)
  seats!: SeatMapSeatData[];

  constructor(params?: {
    libraryId: string;
    slotId: string;
    sectionId?: string;
    seats: SeatMapSeatData[];
  }) {
    if (!params) {
      return;
    }

    this.libraryId = params.libraryId;
    this.slotId = params.slotId;
    this.sectionId = params.sectionId;
    this.seats = params.seats;
  }
}

export class SeatMapApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => SeatMapData)
  data!: SeatMapData;

  constructor(data?: SeatMapData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}

export class OwnerSeatOverviewData {
  @IsString()
  libraryId!: string;

  @IsString()
  slotId!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsNumber()
  totalSeats!: number;

  @IsNumber()
  occupiedSeats!: number;

  @IsNumber()
  pendingSeats!: number;

  @IsNumber()
  availableSeats!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatMapSeatData)
  seats!: SeatMapSeatData[];

  constructor(params?: {
    libraryId: string;
    slotId: string;
    sectionId?: string;
    totalSeats: number;
    occupiedSeats: number;
    pendingSeats: number;
    availableSeats: number;
    seats: SeatMapSeatData[];
  }) {
    if (!params) {
      return;
    }

    this.libraryId = params.libraryId;
    this.slotId = params.slotId;
    this.sectionId = params.sectionId;
    this.totalSeats = params.totalSeats;
    this.occupiedSeats = params.occupiedSeats;
    this.pendingSeats = params.pendingSeats;
    this.availableSeats = params.availableSeats;
    this.seats = params.seats;
  }
}

export class OwnerSeatOverviewApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => OwnerSeatOverviewData)
  data!: OwnerSeatOverviewData;

  constructor(data?: OwnerSeatOverviewData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}

export class LibraryPaymentOptionData {
  @IsString()
  type!: string;

  @IsString()
  label!: string;

  @IsBoolean()
  enabled!: boolean;

  constructor(type?: string, label?: string, enabled?: boolean) {
    if (!type || !label || typeof enabled !== 'boolean') {
      return;
    }

    this.type = type;
    this.label = label;
    this.enabled = enabled;
  }
}

export class LibraryPaymentOptionsApiResponse {
  @IsNumber()
  responseCode!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LibraryPaymentOptionData)
  data!: LibraryPaymentOptionData[];

  constructor(data?: LibraryPaymentOptionData[], responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}

export class BookingData {
  @IsString()
  id!: string;

  @IsString()
  libraryId!: string;

  @IsString()
  libraryName!: string;

  @IsString()
  seatId!: string;

  @IsString()
  slotId!: string;

  @IsString()
  slotName!: string;

  @IsString()
  time!: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsString()
  paymentMethod!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  date!: string;

  @IsString()
  validUntil!: string;

  @IsString()
  status!: string;

  @IsString()
  invoiceNo!: string;

  @IsString()
  libraryAddress!: string;

  @IsOptional()
  @IsString()
  libraryCity?: string;

  @IsOptional()
  @IsString()
  libraryState?: string;

  @IsOptional()
  @IsString()
  libraryPincode?: string;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;

  constructor(params?: {
    id: string;
    libraryId: string;
    libraryName: string;
    seatId: string;
    slotId: string;
    slotName: string;
    time: string;
    sectionId: string | null;
    paymentMethod: string;
    amount: number;
    date: string;
    validUntil: string;
    status: string;
    invoiceNo: string;
    libraryAddress: string;
    libraryCity: string;
    libraryState: string;
    libraryPincode: string;
    libraryLatitude: number | null;
    libraryLongitude: number | null;
  }) {
    if (!params) {
      return;
    }

    this.id = params.id;
    this.libraryId = params.libraryId;
    this.libraryName = params.libraryName;
    this.seatId = params.seatId;
    this.slotId = params.slotId;
    this.slotName = params.slotName;
    this.time = params.time;
    if (params.sectionId) {
      this.sectionId = params.sectionId;
    }
    this.paymentMethod = params.paymentMethod;
    this.amount = params.amount;
    this.date = params.date;
    this.validUntil = params.validUntil;
    this.status = params.status;
    this.invoiceNo = params.invoiceNo;
    this.libraryAddress = params.libraryAddress;
    this.libraryCity = params.libraryCity;
    this.libraryState = params.libraryState;
    this.libraryPincode = params.libraryPincode;
    this.latitude = params.libraryLatitude ?? undefined;
    this.longitude = params.libraryLongitude ?? undefined;
  }
}

export class BookingCreateApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => BookingData)
  data!: BookingData;

  constructor(data?: BookingData, responseCode = 201) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}

export class BookingListPayloadData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingData)
  bookings!: BookingData[];

  @IsNumber()
  page!: number;

  @IsNumber()
  limit!: number;

  @IsNumber()
  total!: number;

  constructor(bookings?: BookingData[], page?: number, limit?: number, total?: number) {
    if (
      !bookings ||
      typeof page !== 'number' ||
      typeof limit !== 'number' ||
      typeof total !== 'number'
    ) {
      return;
    }

    this.bookings = bookings;
    this.page = page;
    this.limit = limit;
    this.total = total;
  }
}

export class BookingListApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => BookingListPayloadData)
  data!: BookingListPayloadData;

  constructor(data?: BookingListPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}

export class BookingDetailApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => BookingData)
  data!: BookingData;

  constructor(data?: BookingData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}

export class OwnerFeeCollectionSummaryData {
  @IsNumber()
  todayAmount!: number;

  @IsNumber()
  todayPayments!: number;

  @IsNumber()
  monthAmount!: number;

  @IsNumber()
  monthPayments!: number;

  @IsNumber()
  pendingCount!: number;

  constructor(params?: {
    todayAmount: number;
    todayPayments: number;
    monthAmount: number;
    monthPayments: number;
    pendingCount: number;
  }) {
    if (!params) {
      return;
    }

    this.todayAmount = params.todayAmount;
    this.todayPayments = params.todayPayments;
    this.monthAmount = params.monthAmount;
    this.monthPayments = params.monthPayments;
    this.pendingCount = params.pendingCount;
  }
}

export class OwnerFeeCollectionItemData {
  @IsString()
  memberId!: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsString()
  studentName!: string;

  @IsString()
  studentPhone!: string;

  @IsString()
  seatId!: string;

  @IsString()
  slotName!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  status!: string;

  @IsString()
  dueDate!: string;

  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsNumber()
  overdueDays!: number;

  constructor(params?: {
    memberId: string;
    bookingId: string | null;
    studentName: string;
    studentPhone: string;
    seatId: string;
    slotName: string;
    amount: number;
    status: string;
    dueDate: string;
    paidAt: string | null;
    overdueDays: number;
  }) {
    if (!params) {
      return;
    }

    this.memberId = params.memberId;
    this.bookingId = params.bookingId || undefined;
    this.studentName = params.studentName;
    this.studentPhone = params.studentPhone;
    this.seatId = params.seatId;
    this.slotName = params.slotName;
    this.amount = params.amount;
    this.status = params.status;
    this.dueDate = params.dueDate;
    this.paidAt = params.paidAt || undefined;
    this.overdueDays = params.overdueDays;
  }
}

export class OwnerFeeCollectionPayloadData {
  @ValidateNested()
  @Type(() => OwnerFeeCollectionSummaryData)
  summary!: OwnerFeeCollectionSummaryData;

  @IsString()
  tab!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OwnerFeeCollectionItemData)
  items!: OwnerFeeCollectionItemData[];

  @IsNumber()
  page!: number;

  @IsNumber()
  limit!: number;

  @IsNumber()
  total!: number;

  constructor(params?: {
    summary: OwnerFeeCollectionSummaryData;
    tab: string;
    items: OwnerFeeCollectionItemData[];
    page: number;
    limit: number;
    total: number;
  }) {
    if (!params) {
      return;
    }

    this.summary = params.summary;
    this.tab = params.tab;
    this.items = params.items;
    this.page = params.page;
    this.limit = params.limit;
    this.total = params.total;
  }
}

export class OwnerFeeCollectionApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => OwnerFeeCollectionPayloadData)
  data!: OwnerFeeCollectionPayloadData;

  constructor(data?: OwnerFeeCollectionPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}

export class BookingMarkPaidApiResponse {
  @IsNumber()
  responseCode!: number;

  @IsString()
  message!: string;

  @ValidateNested()
  @Type(() => OwnerFeeCollectionItemData)
  data!: OwnerFeeCollectionItemData;

  constructor(message?: string, data?: OwnerFeeCollectionItemData, responseCode = 200) {
    if (!message || !data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.message = message;
    this.data = data;
  }
}
