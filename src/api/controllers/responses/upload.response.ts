import { IsNumber, IsString } from 'class-validator';

export class PresignedUrlData {
  @IsString()
  presignedUrl!: string;

  @IsString()
  key!: string;

  @IsString()
  fileUrl!: string;

  constructor(data?: { presignedUrl: string; key: string; fileUrl: string }) {
    if (!data) return;
    this.presignedUrl = data.presignedUrl;
    this.key = data.key;
    this.fileUrl = data.fileUrl;
  }
}

export class PresignedUrlApiResponse {
  @IsNumber()
  responseCode!: number;

  @IsString()
  message!: string;

  data!: PresignedUrlData;

  constructor(data?: PresignedUrlData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.message = 'Presigned URL generated successfully';
    this.data = data;
  }
}

// ← new
export class UploadFileData {
  @IsString()
  key!: string;

  @IsString()
  fileUrl!: string;

  constructor(data?: { key: string; fileUrl: string }) {
    if (!data) return;
    this.key = data.key;
    this.fileUrl = data.fileUrl;
  }
}

// ← new
export class UploadFileApiResponse {
  @IsNumber()
  responseCode!: number;

  @IsString()
  message!: string;

  data!: UploadFileData;

  constructor(data?: UploadFileData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.message = 'File uploaded successfully';
    this.data = data;
  }
}

export class DeleteUploadApiResponse {
  @IsNumber()
  responseCode!: number;

  @IsString()
  message!: string;

  constructor(responseCode = 200) {
    this.responseCode = responseCode;
    this.message = 'File deleted successfully';
  }
}