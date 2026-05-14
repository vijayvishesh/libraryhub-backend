import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { SubmissionRecord } from '../../repositories/types/memberInviteSubmission.repository.types';

export class SubmissionData {
  @IsString() id!: string;
  @IsString() libraryId!: string;
  @IsString() fullName!: string;
  @IsString() mobileNo!: string;
  @IsString() gender!: string;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
  @IsOptional() @IsString() seatId?: string | null;
  @IsOptional() @IsString() slotId?: string | null;
  @IsString() status!: string;
  @IsOptional() @IsString() rejectionReason?: string | null;
  @IsOptional() @IsString() studentId?: string | null;
  @IsOptional() @IsString() memberId?: string | null;
  @IsOptional() @IsString() reviewedAt?: string | null;
  @IsOptional() @IsString() bookingId?: string | null;
  @IsString() createdAt!: string;
  @IsBoolean() isInviteSubmission!: boolean;
  @IsBoolean() isNewUser!: boolean;
  @IsBoolean() isExistingMember!: boolean;
  @IsBoolean() hasPendingFee!: boolean;
  @IsOptional() @IsNumber() pendingFeeAmount?: number | null;
  @IsOptional() @IsString() previousEndDate?: string | null;
  @IsBoolean() isDuplicate!: boolean;

  constructor(r?: SubmissionRecord) {
    if (!r) {
      return;
    }
    this.id = r.id;
    this.libraryId = r.libraryId;
    this.fullName = r.fullName;
    this.mobileNo = r.mobileNo;
    this.gender = r.gender;
    this.startDate = r.startDate;
    this.endDate = r.endDate;
    this.seatId = r.seatId;
    this.slotId = r.slotId;
    this.status = r.status;
    this.rejectionReason = r.rejectionReason;
    this.studentId = r.studentId;
    this.memberId = r.memberId;
    this.bookingId = r.bookingId;
    this.isInviteSubmission = r.isInviteSubmission ?? true;
    this.isNewUser = r.isNewUser ?? false;
    this.isExistingMember = r.isExistingMember ?? false;
    this.hasPendingFee = r.hasPendingFee ?? false;
    this.pendingFeeAmount = r.pendingFeeAmount ?? null;
    this.previousEndDate = r.previousEndDate ?? null;
    this.isDuplicate = r.isDuplicate ?? false;
    this.reviewedAt = r.reviewedAt?.toISOString() ?? null;
    this.createdAt = r.createdAt.toISOString();
  }
}

export class SubmissionApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested() @Type(() => SubmissionData) data!: SubmissionData;
  constructor(data?: SubmissionData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class SubmissionListPayloadData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionData)
  submissions!: SubmissionData[];
  @IsNumber() total!: number;
  @IsNumber() page!: number;
  @IsNumber() limit!: number;

  constructor(submissions?: SubmissionData[], total?: number, page?: number, limit?: number) {
    if (
      !submissions ||
      typeof total !== 'number' ||
      typeof page !== 'number' ||
      typeof limit !== 'number'
    ) {
      return;
    }
    this.submissions = submissions;
    this.total = total;
    this.page = page;
    this.limit = limit;
  }
}

export class SubmissionListApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested() @Type(() => SubmissionListPayloadData) data!: SubmissionListPayloadData;
  constructor(data?: SubmissionListPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }
    this.responseCode = responseCode;
    this.data = data;
  }
}
