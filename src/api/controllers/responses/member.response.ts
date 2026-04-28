import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { env } from '../../../env';

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
  notes?: string;

  @IsString()
  createdAt!: string;

  @IsString()
  updatedAt!: string;

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
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
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
    this.notes = data.notes ?? undefined;
    this.createdAt = data.createdAt.toISOString();
    this.updatedAt = data.updatedAt.toISOString();
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
    this.shareUrl = `${env.app.baseUrl}/public/members/invite/${data.token}`;
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
