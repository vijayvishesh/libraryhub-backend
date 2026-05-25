export type FcmTokenRecord = {
  id: string;
  studentId: string | null;  
  ownerId: string | null;     
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
export type UpsertOwnerFcmTokenInput = {
  ownerId: string;
  token: string;
  deviceType: string;
};