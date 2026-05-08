import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class RateLibraryRequest {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  review?: string;
}