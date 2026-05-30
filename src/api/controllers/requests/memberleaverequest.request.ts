import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { LeaveRequestStatus } from '../../models/memberLeaveRequest.model';

// ─── Student: raise a leave request ────────────────────────────────────────

export class CreateLeaveRequestRequest {
  /** Human-readable reason for leaving */
  @IsString()
  @IsOptional()
  reason?: string | null;

 @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  libraryId!: string;
}

// ─── Owner: approve / reject ────────────────────────────────────────────────

export class ResolveLeaveRequestRequest {
  @IsIn(['approved', 'rejected'] satisfies LeaveRequestStatus[])
  @IsNotEmpty()
  status!: Extract<LeaveRequestStatus, 'approved' | 'rejected'>;

  /** Required when status === 'rejected' */
  @IsString()
  @IsOptional()
  rejectionReason?: string | null;
}

// ─── Owner: paginated list ───────────────────────────────────────────────────

export class ListLeaveRequestsRequest {
  @IsString()
  @IsNotEmpty()
  ownerId!: string;

  @IsIn(['pending', 'approved', 'rejected'] satisfies LeaveRequestStatus[])
  @IsOptional()
  status?: LeaveRequestStatus;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}
// ─── Owner: approve query params ─────────────────────────────────────────────

export class ApproveLeaveRequestQueryParams {
  @IsString()
  @IsNotEmpty()
  libraryId!: string;
}

// ─── Owner: reject query params ──────────────────────────────────────────────

export class RejectLeaveRequestQueryParams {
  @IsString()
  @IsNotEmpty()
  libraryId!: string;
}