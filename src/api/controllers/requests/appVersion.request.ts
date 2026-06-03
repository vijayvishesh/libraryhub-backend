import { IsBoolean, IsIn, IsString } from 'class-validator';
import { AppOs, AppRole } from '../../models/appVersion.model';


export class UpsertAppVersionRequest {
  @IsIn(['android', 'ios'])
  platform!: AppOs;

  @IsIn(['STUDENT', 'OWNER'])
  role!: AppRole;

  @IsString()
  latestVersion!: string;           // e.g. '2.1.0'

  @IsString()
  minVersion!: string;              // e.g. '2.0.0'

  @IsBoolean()
  forceUpdate!: boolean;

  @IsString()
  updateMessage!: string;
}

export class MarkDeviceUpdatedRequest {
  @IsIn(['android', 'ios'])
  platform!: AppOs;

  @IsIn(['STUDENT', 'OWNER'])
  role!: AppRole;

  @IsString()
  deviceId!: string;

  @IsString()
  currentVersion!: string;          // version after update
}

export class CheckUpdateStatusRequest {
  @IsIn(['android', 'ios'])
  platform!: AppOs;

  @IsString()
  currentVersion!: string;

  @IsString()
  deviceId!: string;
}