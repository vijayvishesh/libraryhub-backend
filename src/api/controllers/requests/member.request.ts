import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';

export class AddMemberRequest {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid mobile number' })
  mobileNo!: string;

  @IsString()
  @Matches(/^\d{12}$/, { message: 'Aadhar must be 12 digits' })
  aadharId!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration!: number;
}
