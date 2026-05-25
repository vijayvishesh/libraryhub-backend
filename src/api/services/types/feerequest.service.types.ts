

// ─── Service-layer payloads ──────────────────────────────────────────────────

import { FeeRequestReason, FeeRequestStatus } from "../../models/feerequest.model";

/**
 * Send a fee request to a single student.
 * Owner provides studentId; service resolves the member record for that
 * student inside the owner's library and throws if none is found.
 */
export type SendFeeRequestByStudentPayload = {
  studentId: string;
  amount?: number;  // Overrides planAmount when provided
  note?: string;
  dueDate?: string; // ISO date "YYYY-MM-DD"
  reason: FeeRequestReason;
};

/**
 * Send fee requests to multiple students in one call.
 * If ANY studentId has no member record in this library the whole
 * request is rejected (no partial inserts).
 */
export type SendBulkFeeRequestByStudentPayload = {
  studentIds: string[];
  amount?: number;
  note?: string;
  dueDate?: string;
  reason: FeeRequestReason;
};

export type ListFeeRequestsPayload = {
  studentId?: string;
  memberId?: string;
  status?: FeeRequestStatus;
  reason?: FeeRequestReason;
  batchId?: string;
  page?: number;
  limit?: number;
};

// ─── Service-layer results ───────────────────────────────────────────────────

export type BulkFeeRequestResult = {
  batchId: string;
  sent: number;
};