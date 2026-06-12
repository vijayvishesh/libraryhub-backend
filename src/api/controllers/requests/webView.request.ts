import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class CreateWebViewRequest {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl({}, { message: 'url must be a valid URL' })
  url!: string;

  @IsString()
  @IsNotEmpty()
  icon!: string;

  @IsBoolean()
  isShow!: boolean;

  @IsString()
  @IsIn(['student', 'owner', 'both'])
  role!: 'student' | 'owner' | 'both';

  @IsString()
  @IsIn(['global', 'library'])
  scope!: 'global' | 'library';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  libraryId?: string; // required when scope = 'library'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  order?: number;
}

export class UpdateWebViewRequest {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsUrl({}, { message: 'url must be a valid URL' })
  url?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isShow?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['student', 'owner', 'both'])
  role?: 'student' | 'owner' | 'both';

  @IsOptional()
  @IsString()
  @IsIn(['global', 'library'])
  scope?: 'global' | 'library';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  libraryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  order?: number;
}

export class ListWebViewsQueryRequest {
  @IsOptional()
  @IsString()
  @IsIn(['student', 'owner', 'both'])
  role?: 'student' | 'owner' | 'both';

  @IsOptional()
  @IsString()
  @IsIn(['global', 'library'])
  scope?: 'global' | 'library';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  libraryId?: string;

  @IsOptional()
  @IsBoolean()
  isShow?: boolean;

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
}