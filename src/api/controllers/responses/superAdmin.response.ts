import { Type } from 'class-transformer';
import { IsNumber, IsString, ValidateNested } from 'class-validator';
import { SuperAdminRecord } from '../../repositories/types/superAdmin.repository.types';

export class SuperAdminData {
  @IsString() id!: string;
  @IsString() name!: string;
  @IsString() email!: string;
  @IsString() role!: string;

  constructor(params?: SuperAdminRecord) {
    if (!params) return;
    this.id = params.id;
    this.name = params.name;
    this.email = params.email;
    this.role = params.role;
  }
}

export class SuperAdminTokenData {
  @IsString() accessToken!: string;
  @IsString() refreshToken!: string;

  constructor(accessToken?: string, refreshToken?: string) {
    if (!accessToken || !refreshToken) return;
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
}

export class SuperAdminAuthData {
  @ValidateNested()
  @Type(() => SuperAdminTokenData)
  tokens!: SuperAdminTokenData;

  @ValidateNested()
  @Type(() => SuperAdminData)
  user!: SuperAdminData;

  constructor(tokens?: SuperAdminTokenData, user?: SuperAdminData) {
    if (!tokens || !user) return;
    this.tokens = tokens;
    this.user = user;
  }
}

export class SuperAdminAuthApiResponse {
  @IsNumber() responseCode!: number;
  @ValidateNested()
  @Type(() => SuperAdminAuthData)
  data!: SuperAdminAuthData;

  constructor(data?: SuperAdminAuthData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}