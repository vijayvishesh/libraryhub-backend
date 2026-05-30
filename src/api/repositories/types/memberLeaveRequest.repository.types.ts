export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';

export interface MemberLeaveRequestRecord {
  id: string;
  memberId: string;
  studentId: string;
  libraryId: string;
  bookingId: string | null;
  reason: string | null;
  status: LeaveRequestStatus;
  rejectionReason: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLeaveRequestInput {
  memberId: string;
  studentId: string;
  libraryId: string;
  bookingId: string | null;
  reason?: string | null;
}

export interface UpdateLeaveRequestInput {
  status: LeaveRequestStatus;
  rejectionReason?: string | null;
  resolvedAt?: Date;
  updatedAt?: Date;
}

export interface ListLeaveRequestsQuery {
  libraryId: string;
  status?: LeaveRequestStatus;
  page: number;
  limit: number;
}

export interface ListLeaveRequestsResult {
  requests: MemberLeaveRequestRecord[];
  total: number;
}