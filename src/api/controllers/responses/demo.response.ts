import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CommonResponse } from './common.reponse';

export class DemoSummaryData {
  @IsString()
  service!: string;

  @IsBoolean()
  mongoConnection!: boolean;

  @IsString()
  message!: string;

  constructor(service: string, mongoConnection: boolean, message: string) {
    this.service = service;
    this.mongoConnection = mongoConnection;
    this.message = message;
  }
}

export class DemoDeleteData {
  @IsBoolean()
  deleted!: boolean;

  @IsString()
  id!: string;

  constructor(deleted: boolean, id: string) {
    this.deleted = deleted;
    this.id = id;
  }
}

export class DemoResponse {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  updatedAt?: Date;
}

export class DemoListResponse {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DemoResponse)
  items!: DemoResponse[];
}

export class DemoSummaryApiResponse extends CommonResponse<DemoSummaryData> {
  @ValidateNested()
  @Type(() => DemoSummaryData)
  data!: DemoSummaryData;

  constructor(status: number, data: DemoSummaryData) {
    super(status, data);
    this.data = data;
  }
}

export class DemoItemApiResponse extends CommonResponse<DemoResponse> {
  @ValidateNested()
  @Type(() => DemoResponse)
  data!: DemoResponse;

  constructor(status: number, data: DemoResponse) {
    super(status, data);
    this.data = data;
  }
}

export class DemoListApiResponse extends CommonResponse<DemoListResponse> {
  @ValidateNested()
  @Type(() => DemoListResponse)
  data!: DemoListResponse;

  constructor(status: number, data: DemoListResponse) {
    super(status, data);
    this.data = data;
  }
}

export class DemoDeleteApiResponse extends CommonResponse<DemoDeleteData> {
  @ValidateNested()
  @Type(() => DemoDeleteData)
  data!: DemoDeleteData;

  constructor(status: number, data: DemoDeleteData) {
    super(status, data);
    this.data = data;
  }
}
