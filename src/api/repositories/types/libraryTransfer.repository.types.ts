import { LibraryTransferStatus } from '../../models/libraryTransfer.model';

export type LibraryTransferRecord = {
  id: string;
  libraryId: string;
  oldOwnerId: string;
  oldOwnerPhone: string;
  newOwnerName: string;
  newOwnerPhone: string;
  newOwnerEmail: string | null;
  keepLibraryName: boolean;
  newLibraryName: string | null;
  notifyStudents: boolean;
  oldOwnerOtp: string;
  newOwnerOtp: string;
  otpExpiresAt: Date;
  status: LibraryTransferStatus;
  newOwnerId: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateLibraryTransferInput = {
  libraryId: string;
  oldOwnerId: string;
  oldOwnerPhone: string;
  newOwnerName: string;
  newOwnerPhone: string;
  newOwnerEmail: string | null;
  keepLibraryName: boolean;
  newLibraryName: string | null;
  notifyStudents: boolean;
  oldOwnerOtp: string;
  newOwnerOtp: string;
  otpExpiresAt: Date;
};