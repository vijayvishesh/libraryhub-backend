import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
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
import { SubscriptionService } from '../services/subscription.service';
import {
  AdminActivateBulkSubscriptionRequest,
  AdminActivateSubscriptionRequest,
  AdminListSubscriptionsQueryRequest,
  AdminUpdateSubscriptionRequest,
  CreateSubscriptionPlanRequest,
  UpdateSubscriptionPlanRequest,
} from './requests/subscription.request';
import { CurrentSessionData } from './responses/auth.response';
import { ErrorResponseModel } from './responses/common.reponse';
import {
  BulkActivateApiResponse,
  LibrarySubscriptionApiResponse,
  LibrarySubscriptionListApiResponse,
  LibrarySubscriptionResponseData,
  SubscriptionPlanApiResponse,
  SubscriptionPlanListApiResponse,
  SubscriptionPlanResponseData,
} from './responses/subscription.response';

@Service()
@JsonController('/v1/admin/subscriptions')
export class AdminSubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ── Plan management ──────────────────────────────────────────────

  @Get('/plans')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'List all subscription plans', security: [{ bearerAuth: [] }] })
  @ResponseSchema(SubscriptionPlanListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  public async listPlans(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
  ): Promise<SubscriptionPlanListApiResponse> {
    try {
      const plans = await this.subscriptionService.listPlans(false); // all plans including inactive
      return new SubscriptionPlanListApiResponse(
        plans.map(p => new SubscriptionPlanResponseData(p)),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('LIST_PLANS_FAILED');
    }
  }

  @Post('/plans')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Create a new subscription plan', security: [{ bearerAuth: [] }] })
  @ResponseSchema(SubscriptionPlanApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  public async createPlan(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Body() payload: CreateSubscriptionPlanRequest,
  ): Promise<SubscriptionPlanApiResponse> {
    try {
      const plan = await this.subscriptionService.createPlan({
        ...payload,
        isActive: payload.isActive ?? true,
        sortOrder: payload.sortOrder ?? 0,
      });
      return new SubscriptionPlanApiResponse(new SubscriptionPlanResponseData(plan), 201);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('CREATE_PLAN_FAILED');
    }
  }

  @Patch('/plans/:planId')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Update a subscription plan', security: [{ bearerAuth: [] }] })
  @ResponseSchema(SubscriptionPlanApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  public async updatePlan(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Param('planId') planId: string,
    @Body() payload: UpdateSubscriptionPlanRequest,
  ): Promise<SubscriptionPlanApiResponse> {
    try {
      const plan = await this.subscriptionService.updatePlan(planId, payload);
      return new SubscriptionPlanApiResponse(new SubscriptionPlanResponseData(plan), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('UPDATE_PLAN_FAILED');
    }
  }

  @Delete('/plans/:planId')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Delete a subscription plan', security: [{ bearerAuth: [] }] })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  public async deletePlan(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Param('planId') planId: string,
  ): Promise<{ responseCode: number; message: string }> {
    try {
      await this.subscriptionService.deletePlan(planId);
      return { responseCode: 200, message: 'Plan deleted successfully' };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('DELETE_PLAN_FAILED');
    }
  }

  // ── Library subscription management ─────────────────────────────

  @Get('/')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'List all library subscriptions', security: [{ bearerAuth: [] }] })
  @ResponseSchema(LibrarySubscriptionListApiResponse, { statusCode: 200 })
  public async listSubscriptions(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @QueryParams() query: AdminListSubscriptionsQueryRequest,
  ): Promise<LibrarySubscriptionListApiResponse> {
    try {
      const result = await this.subscriptionService.adminListSubscriptions({
        libraryId: query.libraryId,
        status:    query.status,
        page:      query.page  ?? 1,
        limit:     query.limit ?? 20,
      });
      return new LibrarySubscriptionListApiResponse(
        result.subscriptions.map(s => new LibrarySubscriptionResponseData(s)),
        result.total,
        query.page  ?? 1,
        query.limit ?? 20,
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('LIST_SUBSCRIPTIONS_FAILED');
    }
  }

  // Activate plan for ONE specific library
  @Post('/activate')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Activate subscription plan for a specific library', security: [{ bearerAuth: [] }] })
  @ResponseSchema(LibrarySubscriptionApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  public async activateForLibrary(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Body() payload: AdminActivateSubscriptionRequest,
  ): Promise<LibrarySubscriptionApiResponse> {
    try {
      const sub = await this.subscriptionService.adminActivatePlan(payload);
      return new LibrarySubscriptionApiResponse(new LibrarySubscriptionResponseData(sub), 201);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('ACTIVATE_SUBSCRIPTION_FAILED');
    }
  }

  // Activate plan for ALL libraries at once
  @Post('/activate-bulk')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Activate subscription plan for ALL libraries', security: [{ bearerAuth: [] }] })
  @ResponseSchema(BulkActivateApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  public async activateForAllLibraries(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Body() payload: AdminActivateBulkSubscriptionRequest,
  ): Promise<BulkActivateApiResponse> {
    try {
      const result = await this.subscriptionService.adminActivatePlanForAllLibraries(payload);
      return new BulkActivateApiResponse(result.activated, 201);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('BULK_ACTIVATE_FAILED');
    }
  }

  // Update a specific subscription (change status, extend end date)
  @Patch('/:subscriptionId')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Update a library subscription', security: [{ bearerAuth: [] }] })
  @ResponseSchema(LibrarySubscriptionApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  public async updateSubscription(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Param('subscriptionId') subscriptionId: string,
    @Body() payload: AdminUpdateSubscriptionRequest,
  ): Promise<LibrarySubscriptionApiResponse> {
    try {
      const sub = await this.subscriptionService.adminUpdateSubscription(subscriptionId, payload);
      return new LibrarySubscriptionApiResponse(new LibrarySubscriptionResponseData(sub), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('UPDATE_SUBSCRIPTION_FAILED');
    }
  }
}