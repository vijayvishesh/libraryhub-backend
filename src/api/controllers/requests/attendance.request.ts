import { IsNotEmpty, IsString } from 'class-validator';

export class CheckInRequest {
  @IsString()
  @IsNotEmpty()
  libraryId!: string;
}