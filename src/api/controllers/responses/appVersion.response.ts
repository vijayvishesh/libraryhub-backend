import { IsBoolean, IsNumber, IsString } from 'class-validator';
import { AppVersionRecord } from '../../repositories/types/appVersion.repository.types';

export class AppUpdateStatusData {
  @IsBoolean() requiresUpdate!: boolean;
  @IsBoolean() forceUpdate!:    boolean;
  @IsString()  latestVersion!:  string;
  @IsString()  currentVersion!: string;
  @IsString()  message!:        string;

  constructor(params?: {
    requiresUpdate: boolean;
    forceUpdate:    boolean;
    latestVersion:  string;
    currentVersion: string;
    message:        string;
  }) {
    if (!params) return;
    this.requiresUpdate = params.requiresUpdate;
    this.forceUpdate    = params.forceUpdate;
    this.latestVersion  = params.latestVersion;
    this.currentVersion = params.currentVersion;
    this.message        = params.message;
  }
}

export class AppVersionData {
  @IsString() id!:            string;
  @IsString() platform!:      string;
  @IsString() role!:          string;
  @IsString() latestVersion!: string;
  @IsString() minVersion!:    string;
  @IsBoolean() forceUpdate!:  boolean;
  @IsString() updateMessage!: string;

  constructor(record?: AppVersionRecord) {
    if (!record) return;
    this.id            = record.id;
    this.platform      = record.platform;
    this.role          = record.role;
    this.latestVersion = record.latestVersion;
    this.minVersion    = record.minVersion;
    this.forceUpdate   = record.forceUpdate;
    this.updateMessage = record.updateMessage;
  }
}

export class AppVersionApiResponse {
  @IsNumber() responseCode!: number;
  data!: AppVersionData;

  constructor(data?: AppVersionData, responseCode = 200) {
    if (!data) return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class AppVersionListApiResponse {
  @IsNumber() responseCode!: number;
  data!: AppVersionData[];

  constructor(data?: AppVersionData[], responseCode = 200) {
    if (data === undefined) return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

export class MarkUpdatedApiResponse {
  @IsNumber() responseCode!: number;
  data!: { updated: boolean };

  constructor(responseCode = 200) {
    this.responseCode = responseCode;
    this.data = { updated: true };
  }
}