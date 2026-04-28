import {
  MemberBulkUploadRowResult,
  MemberBulkUploadStatus,
} from '../../models/memberBulkUpload.model';

export type CreateMemberBulkUploadInput = {
  ownerId: string;
  libraryId: string;
  fileName: string;
  status: MemberBulkUploadStatus;
  totalRows: number;
  successCount: number;
  failedCount: number;
  rows: MemberBulkUploadRowResult[];
};

export type MemberBulkUploadRecord = CreateMemberBulkUploadInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ListMemberBulkUploadsQuery = {
  libraryId: string;
  page: number;
  limit: number;
  status?: MemberBulkUploadStatus;
};

export type ListMemberBulkUploadsResult = {
  uploads: MemberBulkUploadRecord[];
  total: number;
};
