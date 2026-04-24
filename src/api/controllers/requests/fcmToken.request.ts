import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RegisterFcmTokenRequest {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsIn(['android', 'ios', 'web'])
  deviceType!: string;
}