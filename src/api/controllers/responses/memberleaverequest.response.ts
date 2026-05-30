

// ─── Single leave-request response ──────────────────────────────────────────

import { LeaveRequestResult } from "../../services/types/memberLeaveRequest.service.types";

export class LeaveRequestResponse {
  id:              string;
  memberId:        string;
  studentId:       string;
  libraryId:       string;
  bookingId:       string | null;
  reason:          string | null;
  status:          'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  resolvedAt:      Date | null;
  createdAt:       Date;
  updatedAt:       Date;

  // enriched — present only in owner list view
  studentName?:  string;
  studentPhone?: string;
  seatId?:       string | null;
  slotId?:       string | null;

  constructor(result: LeaveRequestResult) {
    this.id              = result.id;
    this.memberId        = result.memberId;
    this.studentId       = result.studentId;
    this.libraryId       = result.libraryId;
    this.bookingId       = result.bookingId;
    this.reason          = result.reason;
    this.status          = result.status;
    this.rejectionReason = result.rejectionReason;
    this.resolvedAt      = result.resolvedAt;
    this.createdAt       = result.createdAt;
    this.updatedAt       = result.updatedAt;

    if (result.studentName  !== undefined) this.studentName  = result.studentName;
    if (result.studentPhone !== undefined) this.studentPhone = result.studentPhone;
    if (result.seatId       !== undefined) this.seatId       = result.seatId;
    if (result.slotId       !== undefined) this.slotId       = result.slotId;
  }

  static from(result: LeaveRequestResult): LeaveRequestResponse {
    return new LeaveRequestResponse(result);
  }
}

// ─── Paginated list response ─────────────────────────────────────────────────

export class ListLeaveRequestsResponse {
  requests: LeaveRequestResponse[];
  total:    number;
  page:     number;
  limit:    number;

  constructor(data: {
    requests: LeaveRequestResult[];
    total:    number;
    page:     number;
    limit:    number;
  }) {
    this.requests = data.requests.map(LeaveRequestResponse.from);
    this.total    = data.total;
    this.page     = data.page;
    this.limit    = data.limit;
  }

  static from(data: {
    requests: LeaveRequestResult[];
    total:    number;
    page:     number;
    limit:    number;
  }): ListLeaveRequestsResponse {
    return new ListLeaveRequestsResponse(data);
  }
}