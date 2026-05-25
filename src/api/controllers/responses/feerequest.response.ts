

// ─── Data shape ───────────────────────────────────────────────────────────────

import { FeeRequestReason, FeeRequestStatus } from "../../models/feerequest.model";
import { FeeRequestRecord } from "../../repositories/types/feerequest.repository.types";
import { BulkFeeRequestResult } from "../../services/types/feerequest.service.types";

export class FeeRequestData {
  id:           string;
  libraryId:    string;
  ownerId:      string;
  memberId:     string;
  studentName:  string;
  studentPhone: string;
  bookingId?:   string;
  amount:       number;
  currency:     string;
  reason:       FeeRequestReason;
  status:       FeeRequestStatus;
  note?:        string;
  dueDate?:     string;
  paidAt:       string | null;
  batchId?:     string;
  createdAt:    string;
  updatedAt:    string;

  constructor(record: FeeRequestRecord) {
    this.id           = record.id;
    this.libraryId    = record.libraryId;
    this.ownerId      = record.ownerId;
    this.memberId     = record.memberId;
    this.studentName  = record.studentName;
    this.studentPhone = record.studentPhone;
    this.bookingId    = record.bookingId;
    this.amount       = record.amount;
    this.currency     = record.currency;
    this.reason       = record.reason;
    this.status       = record.status;
    this.note         = record.note;
    this.dueDate      = record.dueDate;
    this.paidAt       = record.paidAt ? record.paidAt.toISOString() : null;
    this.batchId      = record.batchId;
    this.createdAt    = record.createdAt.toISOString();
    this.updatedAt    = record.updatedAt.toISOString();
  }
}

// ─── Single response ──────────────────────────────────────────────────────────

export class FeeRequestApiResponse {
  responseCode: number;
  data:         FeeRequestData;

  constructor(data: FeeRequestData, code = 200) {
    this.responseCode = code;
    this.data         = data;
  }
}

// ─── Paginated list ───────────────────────────────────────────────────────────

export class FeeRequestPaginationMeta {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;

  constructor(page: number, limit: number, total: number) {
    this.page       = page;
    this.limit      = limit;
    this.total      = total;
    this.totalPages = Math.ceil(total / limit);
  }
}

export class ListFeeRequestsApiResponse {
  responseCode: number;
  data:         FeeRequestData[];
  meta:         FeeRequestPaginationMeta;

  constructor(data: FeeRequestData[], meta: FeeRequestPaginationMeta) {
    this.responseCode = 200;
    this.data         = data;
    this.meta         = meta;
  }
}

// ─── Bulk send response ───────────────────────────────────────────────────────

export class BulkFeeRequestApiResponse {
  responseCode: number;
  data:         BulkFeeRequestResult;

  constructor(data: BulkFeeRequestResult) {
    this.responseCode = 201;
    this.data         = data;
  }
}

// ─── Delete response ──────────────────────────────────────────────────────────

export class DeleteFeeRequestApiResponse {
  responseCode: number;
  data:         { deleted: boolean };

  constructor(deleted: boolean) {
    this.responseCode = 200;
    this.data         = { deleted };
  }
}