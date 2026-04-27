import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SuperAdminLoginRequest {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class CreateSuperAdminRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}