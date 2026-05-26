import { FeeRequestReason, FeeRequestStatus } from '../../models/feerequest.model';

// ─── Record returned from repository ─────────────────────────────────────────

export type FeeRequestRecord = {
  id:                   string;
  libraryId:            string;
  ownerId:              string;
  memberId:             string;
  studentName:          string;
  studentPhone:         string;
  bookingId?:           string;
  amount:               number;
  currency:             string;
  reason:               FeeRequestReason;
  status:               FeeRequestStatus;
  note?:                string;
  dueDate?:             string;
  paidAt?:              Date;
  batchId?:             string;
  screenshotUrl?:       string;           // ← new
  screenshotUploadedAt?: Date;            // ← new
  createdAt:            Date;
  updatedAt:            Date;
};

// ─── Input for create ─────────────────────────────────────────────────────────

export type CreateFeeRequestInput = {
  libraryId:    string;
  ownerId:      string;
  memberId:     string;
  studentName:  string;
  studentPhone: string;
  bookingId?:   string;
  amount:       number;
  currency?:    string;
  reason:       FeeRequestReason;
  status?:      FeeRequestStatus;
  note?:        string;
  dueDate?:     string;
  batchId?:     string;
};

// ─── Input for updateStatus ───────────────────────────────────────────────────

export type UpdateFeeRequestStatusInput = {
  status: FeeRequestStatus;
  paidAt?: Date;
};

// ─── List query / result ──────────────────────────────────────────────────────

export type ListFeeRequestsQuery = {
  libraryId?: string;
  ownerId?:   string;
  memberId?:  string;
  status?:    FeeRequestStatus;
  reason?:    FeeRequestReason;
  batchId?:   string;
  page:       number;
  limit:      number;
};

export type ListFeeRequestsResult = {
  feeRequests: FeeRequestRecord[];
  total:       number;
};

// ─── Service-layer payloads ───────────────────────────────────────────────────

/**
 * Send a fee request to a single student.
 * Owner provides memberId (the MemberModel _id); service fetches the member
 * record directly and throws 404 if not found.
 */
export type SendFeeRequestByStudentPayload = {
  memberId: string;          // ← was studentId; now the membership record ID
  amount?: number;           // Overrides planAmount when provided
  note?: string;
  dueDate?: string;          // ISO date "YYYY-MM-DD"
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

// ─── Service-layer results ────────────────────────────────────────────────────

export type BulkFeeRequestResult = {
  batchId: string;
  sent: number;
};