import {
  Authorized,
  Body,
  CurrentUser,
  Get,
  HttpError,
  InternalServerError,
  JsonController,
  Post,
  QueryParam,
  QueryParams,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { SubscriptionService } from '../services/subscription.service';
import { CurrentSessionData } from './responses/auth.response';
import { ErrorResponseModel } from './responses/common.reponse';
import {
  LibrarySubscriptionStatusApiResponse,
  LibrarySubscriptionStatusResponseData,
  SubscriptionPlanListApiResponse,
  SubscriptionPlanResponseData,
} from './responses/subscription.response';
import { CreateSubscriptionOrderRequest, VerifySubscriptionPaymentRequest, RetrySubscriptionOrderRequest, SubscriptionHistoryQueryRequest } from './requests/subscriptionPayment.request';
import { SubscriptionOrderApiResponse, SubscriptionOrderData, SubscriptionActivatedApiResponse, SubscriptionActivatedData, SubscriptionHistoryApiResponse, PaymentHistoryApiResponse, PaymentHistoryItemData } from './responses/subscriptionPayment.response';

@Service()
@JsonController('/v1/subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // Owner: get their library subscription status
  // Returns noPlan: true if no active plan, with available plans list
  @Get('/my')
  @Authorized('OWNER')
  @OpenAPI({ summary: 'Get my library subscription status', security: [{ bearerAuth: [] }] })
  @ResponseSchema(LibrarySubscriptionStatusApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getMySubscription(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @QueryParam('libraryId') libraryId: string,
  ): Promise<LibrarySubscriptionStatusApiResponse> {
    try {
      if (!libraryId) throw new HttpError(400, 'LIBRARY_ID_REQUIRED');
      const result = await this.subscriptionService.getLibrarySubscriptionStatus(libraryId);
      return new LibrarySubscriptionStatusApiResponse(
        new LibrarySubscriptionStatusResponseData(result),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_SUBSCRIPTION_FAILED');
    }
  }

  // Owner: get all available plans (to show purchase options)
  @Get('/plans')
  @Authorized('OWNER')
  @OpenAPI({ summary: 'Get available subscription plans', security: [{ bearerAuth: [] }] })
  @ResponseSchema(SubscriptionPlanListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getAvailablePlans(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
  ): Promise<SubscriptionPlanListApiResponse> {
    try {
      const plans = await this.subscriptionService.listPlans(true); // only active plans
      return new SubscriptionPlanListApiResponse(
        plans.map(p => new SubscriptionPlanResponseData(p)),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_PLANS_FAILED');
    }
  }

  // Step 1: Owner selects plan → get Razorpay order
@Post('/create-order')
@Authorized('OWNER')
@OpenAPI({ summary: 'Create subscription payment order', security: [{ bearerAuth: [] }] })
@ResponseSchema(SubscriptionOrderApiResponse, { statusCode: 201 })
@ResponseSchema(ErrorResponseModel, { statusCode: 400 })
@ResponseSchema(ErrorResponseModel, { statusCode: 404 })
@ResponseSchema(ErrorResponseModel, { statusCode: 409 })
public async createOrder(
  @CurrentUser({ required: true }) session: CurrentSessionData,
  @Body() payload: CreateSubscriptionOrderRequest,
): Promise<SubscriptionOrderApiResponse> {
  try {
    const result = await this.subscriptionService.createSubscriptionOrder(
      session.user.id,
      payload,
    );
    return new SubscriptionOrderApiResponse(
      new SubscriptionOrderData(result),
      201,
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError('CREATE_ORDER_FAILED');
  }
}

// Step 2: Frontend sends payment result → verify & activate
@Post('/verify-payment')
@Authorized('OWNER')
@OpenAPI({ summary: 'Verify payment and activate subscription', security: [{ bearerAuth: [] }] })
@ResponseSchema(SubscriptionActivatedApiResponse, { statusCode: 200 })
@ResponseSchema(ErrorResponseModel, { statusCode: 400 })
@ResponseSchema(ErrorResponseModel, { statusCode: 404 })
@ResponseSchema(ErrorResponseModel, { statusCode: 409 })
public async verifyPayment(
  @CurrentUser({ required: true }) session: CurrentSessionData,
  @Body() payload: VerifySubscriptionPaymentRequest,
): Promise<SubscriptionActivatedApiResponse> {
  try {
    const result = await this.subscriptionService.verifyAndActivateSubscription(
      session.user.id,
      payload,
    );
    return new SubscriptionActivatedApiResponse(
      new SubscriptionActivatedData(result),
      200,
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError('VERIFY_PAYMENT_FAILED');
  }
}

// Retry — owner comes back after failed payment
@Post('/retry-order')
@Authorized('OWNER')
@OpenAPI({ summary: 'Retry subscription payment', security: [{ bearerAuth: [] }] })
@ResponseSchema(SubscriptionOrderApiResponse, { statusCode: 201 })
@ResponseSchema(ErrorResponseModel, { statusCode: 404 })
public async retryOrder(
  @CurrentUser({ required: true }) session: CurrentSessionData,
  @Body() payload: RetrySubscriptionOrderRequest,
): Promise<SubscriptionOrderApiResponse> {
  try {
    const result = await this.subscriptionService.retrySubscriptionOrder(
      session.user.id,
      payload,
    );
    return new SubscriptionOrderApiResponse(new SubscriptionOrderData(result), 201);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError('RETRY_ORDER_FAILED');
  }
}

// Subscription history
@Get('/history')
@Authorized('OWNER')
@OpenAPI({ summary: 'Get subscription history for a library', security: [{ bearerAuth: [] }] })
@ResponseSchema(SubscriptionHistoryApiResponse, { statusCode: 200 })
public async getHistory(
  @CurrentUser({ required: true }) session: CurrentSessionData,
  @QueryParams() query: SubscriptionHistoryQueryRequest,
): Promise<SubscriptionHistoryApiResponse> {
  try {
    const result = await this.subscriptionService.getSubscriptionHistory(
      session.user.id,
      {
        libraryId: query.libraryId,
        status:    query.status,
        page:      query.page  ?? 1,
        limit:     query.limit ?? 20,
      },
    );
    return new SubscriptionHistoryApiResponse(
      result.subscriptions,
      result.total,
      query.page  ?? 1,
      query.limit ?? 20,
      200,
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError('GET_HISTORY_FAILED');
  }
}

// Payment history
@Get('/payment-history')
@Authorized('OWNER')
@OpenAPI({ summary: 'Get payment history for a library', security: [{ bearerAuth: [] }] })
@ResponseSchema(PaymentHistoryApiResponse, { statusCode: 200 })
public async getPaymentHistory(
  @CurrentUser({ required: true }) session: CurrentSessionData,
  @QueryParam('libraryId') libraryId: string,
  @QueryParam('page')  page:  number,
  @QueryParam('limit') limit: number,
): Promise<PaymentHistoryApiResponse> {
  try {
    if (!libraryId) throw new HttpError(400, 'LIBRARY_ID_REQUIRED');
    const result = await this.subscriptionService.getPaymentHistory(
      session.user.id,
      libraryId,
      page  ?? 1,
      limit ?? 20,
    );
    return new PaymentHistoryApiResponse(
      result.payments.map((p: any) => new PaymentHistoryItemData(p)),
      result.total,
      page  ?? 1,
      limit ?? 20,
      200,
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError('GET_PAYMENT_HISTORY_FAILED');
  }
}
}