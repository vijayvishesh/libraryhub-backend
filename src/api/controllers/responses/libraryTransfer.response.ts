import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { LibraryTransferRecord } from '../../repositories/types/libraryTransfer.repository.types';

export class LibraryTransferData {
  @IsString() id!: string;
  @IsString() libraryId!: string;
  @IsString() oldOwnerId!: string;
  @IsString() newOwnerName!: string;
  @IsString() newOwnerPhone!: string;
  @IsOptional() @IsString() newOwnerEmail?: string | null;
  @IsString() status!: string;
  @IsOptional() @IsString() newOwnerId?: string | null;
  @IsOptional() @IsString() completedAt?: string | null;
  @IsString() createdAt!: string;

  constructor(r?: LibraryTransferRecord) {
    if (!r) {
      return;
    }
    this.id = r.id;
    this.libraryId = r.libraryId;
    this.oldOwnerId = r.oldOwnerId;
    this.newOwnerName = r.newOwnerName;
    this.newOwnerPhone = r.newOwnerPhone;
    this.newOwnerEmail = r.newOwnerEmail;
    this.status = r.status;
    this.newOwnerId = r.newOwnerId;
    this.completedAt = r.completedAt?.toISOString() ?? null;
    this.createdAt = r.createdAt.toISOString();
  }
}

export class LibraryTransferApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested() @Type(() => LibraryTransferData) data!: LibraryTransferData;

  constructor(data?: LibraryTransferData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class LibraryTransferInitiateData {
  @IsString() transferId!: string;
  @IsString() message!: string;
  @IsString() otpSentTo!: string;
  @IsString() newOwnerOtpSentTo!: string;
  @IsString() expiresAt!: string;

  constructor(params?: {
    transferId: string;
    message: string;
    otpSentTo: string;
    newOwnerOtpSentTo: string;
    expiresAt: Date;
  }) {
    if (!params) {
      return;
    }
    this.transferId = params.transferId;
    this.message = params.message;
    this.otpSentTo = params.otpSentTo;
    this.newOwnerOtpSentTo = params.newOwnerOtpSentTo;
    this.expiresAt = params.expiresAt.toISOString();
  }
}

export class LibraryTransferInitiateApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => LibraryTransferInitiateData)
  data!: LibraryTransferInitiateData;

  constructor(data?: LibraryTransferInitiateData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') {
      return;
    }
    this.responseCode = responseCode;
    this.data = data;
  }
}
