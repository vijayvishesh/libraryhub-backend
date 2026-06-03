import { AppOs, AppRole } from "../../models/appVersion.model";


export type AppVersionRecord = {
  id:             string;
  platform:       AppOs;
  role:           AppRole;
  latestVersion:  string;
  minVersion:     string;
  forceUpdate:    boolean;
  updateMessage:  string;
  createdAt:      Date;
  updatedAt:      Date;
};

export type DeviceAppVersionRecord = {
  id:             string;
  userId:         string;
  role:           AppRole;
  platform:       AppOs;
  deviceId:       string;
  currentVersion: string;
  isUpdated:      boolean;
  createdAt:      Date;
  updatedAt:      Date;
};

export type UpsertAppVersionInput = {
  platform:      AppOs;
  role:          AppRole;
  latestVersion: string;
  minVersion:    string;
  forceUpdate:   boolean;
  updateMessage: string;
};

export type UpsertDeviceVersionInput = {
  userId:         string;
  role:           AppRole;
  platform:       AppOs;
  deviceId:       string;
  currentVersion: string;
  isUpdated:      boolean;
};

export type AppUpdateStatus = {
  requiresUpdate: boolean;
  forceUpdate:    boolean;
  latestVersion:  string;
  currentVersion: string;
  message:        string;
};