import {
    Authorized,
  Body,
  CurrentUser,
  Get,
  HttpCode,
  JsonController,
  Param,
  Patch,
  Post,
  QueryParams,
} from 'routing-controllers';
import { Service } from 'typedi';
import { MemberLeaveRequestService } from '../services/memberLeaveRequest.service';
import { ApproveLeaveRequestQueryParams, CreateLeaveRequestRequest, ListLeaveRequestsRequest, RejectLeaveRequestQueryParams, ResolveLeaveRequestRequest } from './requests/memberleaverequest.request';
import { LeaveRequestResponse, ListLeaveRequestsResponse } from './responses/memberleaverequest.response';



// ── Minimal auth-user shape expected from your JWT / session middleware ───────
interface AuthUser {
  id:        string; // studentId
  libraryId: string; // active library context
  role:      'student' | 'owner' | 'admin';
}

@Service()
@JsonController('/leave-requests')
export class MemberLeaveRequestController {
  constructor(private readonly leaveRequestService: MemberLeaveRequestService) {}

  // ─── Student: raise a leave request ──────────────────────────────────────
  // POST /leave-requests
  @Post('/')
  @Authorized()
  @HttpCode(201)
  async create(
    @CurrentUser({ required: true }) user: AuthUser,
    @Body({ validate: true }) body: CreateLeaveRequestRequest,
  ): Promise<LeaveRequestResponse> {
    const result = await this.leaveRequestService.raiseLeaveRequest(
        body.userId,
        body.libraryId,
        body.reason ?? undefined,
    );
    return LeaveRequestResponse.from(result);
  }

  // ─── Student: view their pending leave request for current library ────────
  // GET /leave-requests/my
  @Get('/my')
  @Authorized()
  async getMyRequest(
    @CurrentUser({ required: true }) user: AuthUser,
  ): Promise<LeaveRequestResponse | null> {
    const result = await this.leaveRequestService.getMyLeaveRequest(
      user.id,
      user.libraryId,
    );
    return result ? LeaveRequestResponse.from(result) : null;
  }

  // ─── Owner: paginated list for their library ──────────────────────────────
  // GET /leave-requests
  @Get('/')
  @Authorized()
  async listLeaveRequests(
    @CurrentUser({ required: true }) user: AuthUser,
    @QueryParams({ validate: true }) query: ListLeaveRequestsRequest,
  ): Promise<ListLeaveRequestsResponse> {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;

    const { requests, total } = await this.leaveRequestService.listLeaveRequests(
      query.ownerId,     
      query.status,
      page,
      limit,
    );

    return ListLeaveRequestsResponse.from({ requests, total, page, limit });
  }

  // ─── Owner: approve a leave request ──────────────────────────────────────
  // PATCH /leave-requests/:id/approve
  @Patch('/:id/approve')
  @Authorized()
  async approve(
    @CurrentUser({ required: true }) user: AuthUser,
    @Param('id') id: string,
    @QueryParams({ validate: true }) query: ApproveLeaveRequestQueryParams,
  ): Promise<LeaveRequestResponse> {
    const result = await this.leaveRequestService.approveLeaveRequest(
      query.libraryId,
      id,
    );
    return LeaveRequestResponse.from(result);
  }

  // ─── Owner: reject a leave request ───────────────────────────────────────
  // PATCH /leave-requests/:id/reject
  @Patch('/:id/reject')
  @Authorized('owner')
  async reject(
    @CurrentUser({ required: true }) user: AuthUser,
    @Param('id') id: string,
    @Body({ validate: true }) body: ResolveLeaveRequestRequest,
    @QueryParams({ validate: true }) query: RejectLeaveRequestQueryParams,
  ): Promise<LeaveRequestResponse> {
    const result = await this.leaveRequestService.rejectLeaveRequest(
      query.libraryId,
      id,
      body.rejectionReason ?? undefined,
    );
    return LeaveRequestResponse.from(result);
  }
}