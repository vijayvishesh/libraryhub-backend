import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
// import { env } from '../../../env';

export class MemberData {
  @IsString()
  id!: string;

  @IsString()
  fullName!: string;

  @IsString()
  mobileNo!: string;

  @IsOptional()
  @IsString()
  aadharId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNumber()
  duration!: number;

  @IsString()
  libraryId!: string;

  @IsOptional()
  @IsString()
  seatId?: string;

  @IsOptional()
  @IsString()
  slotId?: string;

  @IsString()
  status!: string;

  @IsOptional()
  @IsNumber()
  planAmount?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  createdAt!: string;

  @IsString()
  updatedAt!: string;

  @IsOptional()
  @IsBoolean()
  isInviteSubmission?: boolean;

  @IsBoolean()
  isNewUser!: boolean;

  @IsBoolean()
  isExistingMember!: boolean;

  @IsBoolean()
  hasPendingFee!: boolean;

  @IsOptional()
  @IsNumber()
  pendingFeeAmount!: number | null;

  @IsOptional()
  @IsString()
  previousEndDate!: string | null;

  @IsBoolean()
  isDuplicate!: boolean;

  @IsOptional()
  @IsString()
  paymentMethod?: string | null;       

  @IsOptional()
  @IsString()
  paymentScreenshotUrl?: string | null; 

  @IsOptional()
  @IsString()
  paymentStatus?: string;              

  constructor(data?: {
    id: string;
    fullName: string;
    mobileNo: string;
    aadharId: string | null;
    studentId: string | null;
    email: string | null;
    duration: number;
    libraryId: string;
    seatId: string | null;
    slotId: string | null;
    status: string;
    planAmount: number | null;
    startDate: string | null;
    endDate: string | null;
    bookingId: string | null;
    paidAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    isInviteSubmission?: boolean;
    isNewUser?: boolean;
    isExistingMember?: boolean;
    hasPendingFee?: boolean;
    pendingFeeAmount?: number | null;
    previousEndDate?: string | null;
    isDuplicate?: boolean;
    paymentMethod?: string | null;        
    paymentScreenshotUrl?: string | null; 
    
  }) {
    if (!data) {
      return;
    }

    this.id = data.id;
    this.fullName = data.fullName;
    this.mobileNo = data.mobileNo;
    this.aadharId = data.aadharId ?? undefined;
    this.studentId = data.studentId ?? undefined;
    this.email = data.email ?? undefined;
    this.duration = data.duration;
    this.libraryId = data.libraryId;
    this.seatId = data.seatId ?? undefined;
    this.slotId = data.slotId ?? undefined;
    this.status = data.status;
    this.planAmount = data.planAmount ?? undefined;
    this.startDate = data.startDate ?? undefined;
    this.endDate = data.endDate ?? undefined;
    this.bookingId = data.bookingId ?? undefined;
    this.paidAt = data.paidAt ? data.paidAt.toISOString() : undefined;
    this.notes = data.notes ?? undefined;
    this.createdAt = data.createdAt.toISOString();
    this.updatedAt = data.updatedAt.toISOString();
    this.isInviteSubmission = data.isInviteSubmission ?? false;
    this.isNewUser = data.isNewUser ?? false;
    this.isExistingMember = data.isExistingMember ?? false;
    this.hasPendingFee = data.hasPendingFee ?? false;
    this.pendingFeeAmount = data.pendingFeeAmount ?? null;
    this.previousEndDate = data.previousEndDate ?? null;
    this.isDuplicate = data.isDuplicate ?? false;
    this.paymentMethod = data.paymentMethod ?? null;
    this.paymentScreenshotUrl = data.paymentScreenshotUrl ?? null;
    this.paymentStatus = data.status === 'active' ? 'confirmed' : 'pending';
    
  }
}

export class MemberCreateApiResponse {
  @IsNumber()
  responseCode!: number;

  @IsString()
  message!: string;

  constructor(message: string, responseCode = 201) {
    this.responseCode = responseCode;
    this.message = message;
  }
}

export class MemberDetailApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => MemberData)
  data!: MemberData;

  constructor(data?: MemberData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}

export class MemberListPayloadData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberData)
  members!: MemberData[];

  @IsNumber()
  page!: number;

  @IsNumber()
  limit!: number;

  @IsNumber()
  total!: number;

  constructor(members?: MemberData[], page?: number, limit?: number, total?: number) {
    if (
      !members ||
      typeof page !== 'number' ||
      typeof limit !== 'number' ||
      typeof total !== 'number'
    ) {
      return;
    }

    this.members = members;
    this.page = page;
    this.limit = limit;
    this.total = total;
  }
}

export class MemberListApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => MemberListPayloadData)
  data!: MemberListPayloadData;

  constructor(data?: MemberListPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}

export class MemberActionApiResponse {
  @IsNumber()
  responseCode!: number;

  @IsString()
  message!: string;

  constructor(message?: string, responseCode = 200) {
    if (!message || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.message = message;
  }
}

export class MemberUploadData {
  @IsString()
  id!: string;

  @IsString()
  fileName!: string;

  @IsString()
  status!: string;

  @IsNumber()
  totalRows!: number;

  @IsNumber()
  successCount!: number;

  @IsNumber()
  failedCount!: number;

  @IsString()
  createdAt!: string;

  @IsString()
  updatedAt!: string;

  constructor(data?: {
    id: string;
    fileName: string;
    status: string;
    totalRows: number;
    successCount: number;
    failedCount: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    if (!data) {
      return;
    }

    this.id = data.id;
    this.fileName = data.fileName;
    this.status = data.status;
    this.totalRows = data.totalRows;
    this.successCount = data.successCount;
    this.failedCount = data.failedCount;
    this.createdAt = data.createdAt.toISOString();
    this.updatedAt = data.updatedAt.toISOString();
  }
}

export class MemberUploadApiResponse {
  @IsNumber()
  responseCode!: number;

  @IsString()
  message!: string;

  @ValidateNested()
  @Type(() => MemberUploadData)
  data!: MemberUploadData;

  constructor(message?: string, data?: MemberUploadData, responseCode = 200) {
    if (!message || !data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.message = message;
    this.data = data;
  }
}

export class MemberUploadListPayloadData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberUploadData)
  uploads!: MemberUploadData[];

  @IsNumber()
  page!: number;

  @IsNumber()
  limit!: number;

  @IsNumber()
  total!: number;

  constructor(uploads?: MemberUploadData[], page?: number, limit?: number, total?: number) {
    if (
      !uploads ||
      typeof page !== 'number' ||
      typeof limit !== 'number' ||
      typeof total !== 'number'
    ) {
      return;
    }

    this.uploads = uploads;
    this.page = page;
    this.limit = limit;
    this.total = total;
  }
}

export class MemberUploadListApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => MemberUploadListPayloadData)
  data!: MemberUploadListPayloadData;

  constructor(data?: MemberUploadListPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.data = data;
  }
}

export class MemberInviteLinkData {
  @IsString()
  id!: string;

  @IsString()
  token!: string;

  @IsString()
  siteLibraryId!: string;

  @IsNumber()
  expiresIn!: number;

  @IsString()
  shareUrl!: string;

  constructor(data?: { id: string; token: string; siteLibraryId: string; expiresAt: Date }) {
    if (!data) {
      return;
    }

    this.id = data.id;
    this.token = data.token;
    this.siteLibraryId = data.siteLibraryId;
    this.expiresIn = Math.max(0, Math.floor((data.expiresAt.getTime() - Date.now()) / 1000));
    this.shareUrl = `/public/members/invite/${data.token}`;
  }
}

export class MemberInviteLinkApiResponse {
  @IsNumber()
  responseCode!: number;

  @IsString()
  message!: string;

  @ValidateNested()
  @Type(() => MemberInviteLinkData)
  data!: MemberInviteLinkData;

  constructor(message?: string, data?: MemberInviteLinkData, responseCode = 200) {
    if (!message || !data || typeof responseCode !== 'number') {
      return;
    }

    this.responseCode = responseCode;
    this.message = message;
    this.data = data;
  }
}
export class RenewalReminderTabCounts {
  @IsNumber()
  today!: number;

  @IsNumber()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '3Days'!: number;

  @IsNumber()
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '7Days'!: number;

  @IsNumber()
  month!: number;
}

export class RenewalRemindersPayloadData {
  @ValidateNested({ each: true })
  @Type(() => MemberData)
  members!: MemberData[];

  @ValidateNested()
  @Type(() => RenewalReminderTabCounts)
  tabCounts!: RenewalReminderTabCounts;

  @IsNumber()
  totalAtRisk!: number;

  constructor(data?: {
    members: MemberData[];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    tabCounts: { today: number; '3Days': number; '7Days': number; month: number };
    totalAtRisk: number;
  }) {
    if (!data) {
      return;
    }
    this.members = data.members;
    this.tabCounts = Object.assign(new RenewalReminderTabCounts(), data.tabCounts);
    this.totalAtRisk = data.totalAtRisk;
  }
}

export class RenewalRemindersApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => RenewalRemindersPayloadData)
  data!: RenewalRemindersPayloadData;

  constructor(data?: RenewalRemindersPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class MemberPaymentData {
  @IsString()
  id!: string;

  @IsString()
  memberId!: string;

  @IsNumber()
  amount!: number;

  @IsNumber()
  duration!: number;

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsString()
  paidAt!: string;

  @IsString()
  createdAt!: string;

  @IsString()
  type!: string; 

  @IsString()
  status!: string; 

  constructor(data?: {
    id: string;
    memberId: string;
    amount: number;
    duration: number;
    startDate: string;
    endDate: string;
    paidAt: Date;
    createdAt: Date;
    paymentMethod?:        string | null;   
    paymentScreenshotUrl?: string | null;   
    type?:                 string;          
    status?:               string;          
  }) {
    if (!data) {
      return;
    }
    this.id = data.id;
    this.memberId = data.memberId;
    this.amount = data.amount;
    this.duration = data.duration;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.type = data.type?? 'first_join';
    this.status= data.status?? 'pending';
    this.paidAt = data.paidAt.toISOString();
    this.createdAt = data.createdAt.toISOString();
  }
}

export class MemberPaymentListPayloadData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberPaymentData)
  payments!: MemberPaymentData[];

  @IsNumber()
  page!: number;

  @IsNumber()
  limit!: number;

  @IsNumber()
  total!: number;

  constructor(payments?: MemberPaymentData[], page?: number, limit?: number, total?: number) {
    if (
      !payments ||
      typeof page !== 'number' ||
      typeof limit !== 'number' ||
      typeof total !== 'number'
    ) {
      return;
    }
    this.payments = payments;
    this.page = page;
    this.limit = limit;
    this.total = total;
  }
}

export class MemberPaymentListApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => MemberPaymentListPayloadData)
  data!: MemberPaymentListPayloadData;

  constructor(data?: MemberPaymentListPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class InactiveMemberData {
  @IsString()
  id!: string;

  @IsString()
  fullName!: string;

  @IsString()
  mobileNo!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  seatId?: string;

  @IsOptional()
  @IsString()
  slotId?: string;

  @IsString()
  status!: string;

  @IsString()
  memberType!: 'expired' | 'overdue' | 'inactive'; // derived type

  @IsOptional()
  @IsNumber()
  planAmount?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsString()
  createdAt!: string;

  @IsString()
  updatedAt!: string;

  constructor(data?: {
    id: string;
    fullName: string;
    mobileNo: string;
    email: string | null;
    seatId: string | null;
    slotId: string | null;
    status: string;
    memberType: 'expired' | 'overdue' | 'inactive';
    planAmount: number | null;
    startDate: string | null;
    endDate: string | null;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    if (!data) return;
    this.id = data.id;
    this.fullName = data.fullName;
    this.mobileNo = data.mobileNo;
    this.email = data.email ?? undefined;
    this.seatId = data.seatId ?? undefined;
    this.slotId = data.slotId ?? undefined;
    this.status = data.status;
    this.memberType = data.memberType;
    this.planAmount = data.planAmount ?? undefined;
    this.startDate = data.startDate ?? undefined;
    this.endDate = data.endDate ?? undefined;
    this.paidAt = data.paidAt ? data.paidAt.toISOString() : undefined;
    this.createdAt = data.createdAt.toISOString();
    this.updatedAt = data.updatedAt.toISOString();
  }
}

export class InactiveMembersListPayloadData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InactiveMemberData)
  members!: InactiveMemberData[];

  @IsNumber()
  page!: number;

  @IsNumber()
  limit!: number;

  @IsNumber()
  total!: number;

  // Summary counts always returned regardless of filter
  @IsNumber()
  expiredCount!: number;

  @IsNumber()
  overdueCount!: number;

  @IsNumber()
  inactiveCount!: number;

  constructor(data?: {
    members: InactiveMemberData[];
    page: number;
    limit: number;
    total: number;
    expiredCount: number;
    overdueCount: number;
    inactiveCount: number;
  }) {
    if (!data) return;
    this.members = data.members;
    this.page = data.page;
    this.limit = data.limit;
    this.total = data.total;
    this.expiredCount = data.expiredCount;
    this.overdueCount = data.overdueCount;
    this.inactiveCount = data.inactiveCount;
  }
}

export class InactiveMembersApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => InactiveMembersListPayloadData)
  data!: InactiveMembersListPayloadData;

  constructor(data?: InactiveMembersListPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}