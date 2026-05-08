import {
  Authorized,
  Body,
  CurrentUser,
  Get,
  HttpError,
  InternalServerError,
  JsonController,
  Param,
  Patch,
  Post,
  QueryParams,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { MemberInviteSubmissionService } from '../services/memberInviteSubmission.service';
import {
  BulkReviewRequest,
  ListSubmissionsQueryRequest,
  ReviewSubmissionRequest,
  SubmitInviteFormRequest,
  UpdateSubmissionRequest,
} from './requests/memberInviteSubmission.request';
import { CurrentSessionData } from './responses/auth.response';
import {
  SubmissionApiResponse,
  SubmissionData,
  SubmissionListApiResponse,
  SubmissionListPayloadData,
} from './responses/memberInviteSubmission.response';
import { ErrorResponseModel } from './responses/common.reponse';

@Service()
@JsonController()
@OpenAPI({ tags: ['Member Invite Submissions'] })
export class MemberInviteSubmissionController {
  constructor(
    private readonly submissionService: MemberInviteSubmissionService,
  ) {}

  // ── PUBLIC: Student submits form ─────────────────────────────────────────
  @Post('/public/members/invite/:token/submit-v2')
  @OpenAPI({ summary: 'Submit simplified invite form (student name, phone, gender, dates, seat)' })
  @ResponseSchema(SubmissionApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async submitInviteForm(
    @Param('token') token: string,
    @Body() payload: SubmitInviteFormRequest,
  ): Promise<SubmissionApiResponse> {
    try {
      const submission = await this.submissionService.submitForm(token.trim(), payload);
      return new SubmissionApiResponse(new SubmissionData(submission), 201);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('SUBMIT_INVITE_FORM_FAILED');
    }
  }

  // ── OWNER: List all submissions for their library ─────────────────────────
  @Get('/owner/invite-submissions')
  @Authorized('OWNER')
  @OpenAPI({ summary: 'List invite form submissions', security: [{ bearerAuth: [] }] })
  @ResponseSchema(SubmissionListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async listSubmissions(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @QueryParams() query: ListSubmissionsQueryRequest,
  ): Promise<SubmissionListApiResponse> {
    try {
      const result = await this.submissionService.listSubmissions(session.user.id, query);
      return new SubmissionListApiResponse(
        new SubmissionListPayloadData(
          result.submissions.map(s => new SubmissionData(s)),
          result.total,
          result.page,
          result.limit,
        ),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('LIST_SUBMISSIONS_FAILED');
    }
  }

  // ── OWNER: Edit a pending submission ─────────────────────────────────────
  @Patch('/owner/invite-submissions/:submissionId')
  @Authorized('OWNER')
  @OpenAPI({ summary: 'Edit a pending submission', security: [{ bearerAuth: [] }] })
  @ResponseSchema(SubmissionApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async updateSubmission(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('submissionId') submissionId: string,
    @Body() payload: UpdateSubmissionRequest,
  ): Promise<SubmissionApiResponse> {
    try {
      const submission = await this.submissionService.updateSubmission(
        session.user.id,
        submissionId,
        payload,
      );
      return new SubmissionApiResponse(new SubmissionData(submission), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('UPDATE_SUBMISSION_FAILED');
    }
  }

  // ── OWNER: Approve or reject a single submission ──────────────────────────
  @Patch('/owner/invite-submissions/:submissionId/review')
  @Authorized('OWNER')
  @OpenAPI({ summary: 'Approve or reject a single submission', security: [{ bearerAuth: [] }] })
  @ResponseSchema(SubmissionApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async reviewSubmission(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('submissionId') submissionId: string,
    @Body() payload: ReviewSubmissionRequest,
  ): Promise<SubmissionApiResponse> {
    try {
      const submission = await this.submissionService.reviewSubmission(
        session.user.id,
        submissionId,
        payload,
      );
      return new SubmissionApiResponse(new SubmissionData(submission), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('REVIEW_SUBMISSION_FAILED');
    }
  }

  // ── OWNER: Bulk approve / reject selected ────────────────────────────────
  @Post('/owner/invite-submissions/bulk-review')
  @Authorized('OWNER')
  @OpenAPI({ summary: 'Bulk approve or reject submissions', security: [{ bearerAuth: [] }] })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async bulkReview(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: BulkReviewRequest,
  ): Promise<{ responseCode: number; data: { processed: number; failed: number } }> {
    try {
      const result = await this.submissionService.bulkReview(session.user.id, payload);
      return { responseCode: 200, data: result };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('BULK_REVIEW_FAILED');
    }
  }

  // ── OWNER: Approve ALL pending ────────────────────────────────────────────
  @Post('/owner/invite-submissions/approve-all')
  @Authorized('OWNER')
  @OpenAPI({ summary: 'Approve all pending submissions', security: [{ bearerAuth: [] }] })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async approveAll(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<{ responseCode: number; data: { processed: number; failed: number } }> {
    try {
      const result = await this.submissionService.approveAll(session.user.id);
      return { responseCode: 200, data: result };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('APPROVE_ALL_FAILED');
    }
  }
}