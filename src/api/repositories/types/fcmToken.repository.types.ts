export type FcmTokenRecord = {
  id: string;
  studentId: string;
  token: string;
  deviceType: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertFcmTokenInput = {
  studentId: string;
  token: string;
  deviceType: string;
};