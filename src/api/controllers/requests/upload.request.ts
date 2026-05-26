import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GeneratePresignedUrlRequest {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  folder?: string;
}

export class DeleteUploadRequest {
  @IsString()
  @IsNotEmpty()
  key!: string;
}

export class UploadFolderQueryRequest {
  @IsOptional()
  @IsString()
  @IsIn(['avatars', 'logos', 'library-photos', 'uploads'])
  folder?: string;
}
export class ConfirmUploadRequest {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsOptional()
  @IsString()
  folder?: string;
}