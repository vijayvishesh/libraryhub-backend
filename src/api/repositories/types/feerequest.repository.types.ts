

// ─── Records (what comes out of the DB layer) ───────────────────────────────

import { FeeRequestReason, FeeRequestStatus } from "../../models/feerequest.model";

export type FeeRequestRecord = {
  id: string;
  libraryId: string;
  ownerId: string;
  memberId: string;
  studentName: string;
  studentPhone: string;
  bookingId?: string;
  amount: number;
  currency: string;
  reason: FeeRequestReason;
  status: FeeRequestStatus;
  note?: string;
  dueDate?: string;
  paidAt?: Date;
  batchId?: string;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Inputs ─────────────────────────────────────────────────────────────────

export type CreateFeeRequestInput = {
  libraryId: string;
  ownerId: string;
  memberId: string;
  studentName: string;
  studentPhone: string;
  bookingId?: string;
  amount: number;
  currency?: string;
  reason: FeeRequestReason;
  status?: FeeRequestStatus;
  note?: string;
  dueDate?: string;
  batchId?: string;
};

export type UpdateFeeRequestStatusInput = {
  status: FeeRequestStatus;
  paidAt?: Date;
};

export type ListFeeRequestsQuery = {
  libraryId?: string;
  ownerId?: string;
  memberId?: string;
  status?: FeeRequestStatus;
  reason?: FeeRequestReason;
  batchId?: string;
  page: number;
  limit: number;
};

export type ListFeeRequestsResult = {
  feeRequests: FeeRequestRecord[];
  total: number;
};