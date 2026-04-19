import { IsEmail, IsNumber, IsOptional, IsString } from 'class-validator';

export class MemberData {
  @IsString()
  id!: string;

  @IsString()
  fullName!: string;

  @IsString()
  mobileNo!: string;

  @IsString()
  aadharId!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNumber()
  duration!: number;

  @IsString()
  libraryId!: string;

  @IsString()
  createdAt!: string;

  @IsString()
  updatedAt!: string;

  constructor(data?: {
    id: string;
    fullName: string;
    mobileNo: string;
    aadharId: string;
    email: string | null;
    duration: number;
    libraryId: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    if (!data) {
      return;
    }

    this.id = data.id;
    this.fullName = data.fullName;
    this.mobileNo = data.mobileNo;
    this.aadharId = data.aadharId;
    this.email = data.email ?? undefined;
    this.duration = data.duration;
    this.libraryId = data.libraryId;
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
