import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { LibraryRatingRecord } from '../../repositories/types/libraryRating.repository.types';

export class LibraryRatingData {
  @IsString()
  id!: string;

  @IsString()
  libraryId!: string;

  @IsString()
  studentId!: string;

  @IsNumber()
  rating!: number;

  @IsOptional()
  @IsString()
  review!: string | null;

  @IsDate()
  createdAt!: Date;

  @IsDate()
  updatedAt!: Date;

  constructor(params?: LibraryRatingRecord) {
    if (!params) return;
    this.id        = params.id;
    this.libraryId = params.libraryId;
    this.studentId = params.studentId;
    this.rating    = params.rating;
    this.review    = params.review ?? null;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }
}

export class LibraryRatingApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => LibraryRatingData)
  data!: LibraryRatingData;

  constructor(data?: LibraryRatingData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class LibraryRatingsListApiResponse {
  @IsNumber()
  responseCode!: number;

  data!: { ratings: LibraryRatingData[]; total: number };

  constructor(ratings: LibraryRatingData[], responseCode = 200) {
    this.responseCode = responseCode;
    this.data = { ratings, total: ratings.length };
  }
}

export class LibraryRatingSummaryData {
  @IsNumber()
  average!: number;

  @IsNumber()
  count!: number;

  constructor(params?: { average: number; count: number }) {
    if (!params) return;
    this.average = params.average;
    this.count   = params.count;
  }
}

export class LibraryRatingSummaryApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => LibraryRatingSummaryData)
  data!: LibraryRatingSummaryData;

  constructor(data?: LibraryRatingSummaryData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}