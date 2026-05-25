import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  Get,
  HttpCode,
  HttpError,
  InternalServerError,
  JsonController,
  Param,
  Post,
  QueryParams,
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { Service } from 'typedi';

import { CurrentSessionData } from './responses/auth.response';
import { FeeRequestRecord } from '../repositories/types/feerequest.repository.types';
import { FeeRequestService } from '../services/feerequest.service';
import { SendFeeRequestByStudentRequest, SendBulkFeeRequestByStudentRequest, ListFeeRequestsQueryRequest } from './requests/feerequest.request';
import { FeeRequestApiResponse, BulkFeeRequestApiResponse, ListFeeRequestsApiResponse, FeeRequestPaginationMeta, DeleteFeeRequestApiResponse, FeeRequestData } from './responses/feerequest.response';


@Service()
@JsonController('/v1/fee-requests')
export class FeeRequestController {
  constructor(private readonly feeRequestService: FeeRequestService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // POST /v1/fee-requests
  // Send fee request to ONE student
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @swagger
   * /api/v1/fee-requests:
   *   post:
   *     summary: Send a fee payment request to a single student
   *     description: |
   *       Owner sends a fee request to one student (looked up by studentId).
   *       Student must have a member record in the owner's library — 404 otherwise.
   *
   *       To mark payment as received use the existing:
   *       PATCH /owner/members/:memberId/mark-paid
   *
   *       **reason → required member status:**
   *       | reason | member.status must be |
   *       |---|---|
   *       | new_joinee | pending |
   *       | subscription_expired | expired |
   *       | subscription_renewal | active |
   *       | manual | any |
   *     tags: [FeeRequests]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           example:
   *             studentId: "6650a1b2c3d4e5f6a7b8c9d0"
   *             reason: "new_joinee"
   *             amount: 1500
   *             note: "Please pay your joining fee"
   *             dueDate: "2025-07-01"
   */
  @Post('/')
  @HttpCode(201)
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  public async sendFeeRequest(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() body: SendFeeRequestByStudentRequest,
  ): Promise<FeeRequestApiResponse> {
    try {
      const record = await this.feeRequestService.sendFeeRequestByStudent(session.user.id, {
        studentId: body.studentId,
        amount:    body.amount,
        reason:    body.reason,
        note:      body.note,
        dueDate:   body.dueDate,
      });
      return new FeeRequestApiResponse(this.mapFeeRequest(record), 201);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('SEND_FEE_REQUEST_FAILED');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /v1/fee-requests/bulk
  // Send fee requests to MULTIPLE students — all-or-nothing
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @swagger
   * /api/v1/fee-requests/bulk:
   *   post:
   *     summary: Send fee requests to multiple students (all-or-nothing)
   *     description: |
   *       Bulk-send fee requests by student IDs.
   *
   *       **All-or-nothing:** if ANY studentId has no member record the entire
   *       request is rejected — nothing is written to the DB.
   *
   *       All created requests share one `batchId` so you can filter them via:
   *       GET /v1/fee-requests?batchId=<batchId>
   *
   *       To mark payments as received use the existing:
   *       PATCH /owner/members/:memberId/mark-paid
   *     tags: [FeeRequests]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           example:
   *             studentIds:
   *               - "6650a1b2c3d4e5f6a7b8c9d0"
   *               - "6650a1b2c3d4e5f6a7b8c9d1"
   *             reason: "subscription_expired"
   *             note: "Your subscription has expired. Please renew."
   *             dueDate: "2025-07-01"
   */
  @Post('/bulk')
  @HttpCode(201)
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  public async sendBulkFeeRequests(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() body: SendBulkFeeRequestByStudentRequest,
  ): Promise<BulkFeeRequestApiResponse> {
    try {
      const result = await this.feeRequestService.sendBulkFeeRequestsByStudent(session.user.id, {
        studentIds: body.studentIds,
        amount:     body.amount,
        reason:     body.reason,
        note:       body.note,
        dueDate:    body.dueDate,
      });
      return new BulkFeeRequestApiResponse(result);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('SEND_BULK_FEE_REQUEST_FAILED');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /v1/fee-requests
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @swagger
   * /api/v1/fee-requests:
   *   get:
   *     summary: List fee requests for the owner's library
   *     tags: [FeeRequests]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: studentId
   *         description: Filter by student user ID
   *       - in: query
   *         name: memberId
   *         description: Filter by member ID
   *       - in: query
   *         name: status
   *         schema: { enum: [pending, paid, cancelled, expired] }
   *       - in: query
   *         name: reason
   *         schema: { enum: [new_joinee, subscription_expired, subscription_renewal, manual] }
   *       - in: query
   *         name: batchId
   *         description: Filter all requests from one bulk send
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   */
  @Get('/')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  public async listFeeRequests(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @QueryParams() query: ListFeeRequestsQueryRequest,
  ): Promise<ListFeeRequestsApiResponse> {
    try {
      const result = await this.feeRequestService.listFeeRequests(session.user.id, {
        studentId: query.studentId,
        memberId:  query.memberId,
        status:    query.status as any,
        reason:    query.reason as any,
        batchId:   query.batchId,
        page:      query.page,
        limit:     query.limit,
      });
      const meta = new FeeRequestPaginationMeta(
        query.page  ?? 1,
        query.limit ?? 20,
        result.total,
      );
      return new ListFeeRequestsApiResponse(
        result.feeRequests.map(r => this.mapFeeRequest(r)),
        meta,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('LIST_FEE_REQUESTS_FAILED');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET /v1/fee-requests/:id
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @swagger
   * /api/v1/fee-requests/{id}:
   *   get:
   *     summary: Get a single fee request by ID
   *     tags: [FeeRequests]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   */
  @Get('/:id')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  public async getFeeRequestById(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<FeeRequestApiResponse> {
    try {
      const record = await this.feeRequestService.getFeeRequestById(id);
      return new FeeRequestApiResponse(this.mapFeeRequest(record));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_FEE_REQUEST_FAILED');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /v1/fee-requests/:id
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * @swagger
   * /api/v1/fee-requests/{id}:
   *   delete:
   *     summary: Delete a fee request
   *     tags: [FeeRequests]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   */
  @Delete('/:id')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  public async deleteFeeRequest(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<DeleteFeeRequestApiResponse> {
    try {
      await this.feeRequestService.deleteFeeRequest(id);
      return new DeleteFeeRequestApiResponse(true);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('DELETE_FEE_REQUEST_FAILED');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private
  // ─────────────────────────────────────────────────────────────────────────

  private mapFeeRequest(record: FeeRequestRecord): FeeRequestData {
    return new FeeRequestData(record);
  }
}