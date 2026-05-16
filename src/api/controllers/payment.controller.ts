import {
  Authorized,
  BadRequestError,
  Body,
  CurrentUser,
  Delete,
  Get,
  HttpCode,
  JsonController,
  Param,
  Patch,
  Post,
  QueryParams,
} from 'routing-controllers';
import { Service } from 'typedi';
import { PaymentService } from '../services/payment.service';
import { CurrentSessionData } from './responses/auth.response';
import {
  CreatePaymentRequest,
  CreateRazorpayOrderRequest,
  ListPaymentsQueryRequest,
  UpdatePaymentStatusRequest,
  VerifyRazorpayPaymentRequest,
} from './requests/payment.request';
import {
  DeletePaymentApiResponse,
  ListPaymentsApiResponse,
  PaymentApiResponse,
  PaymentData,
  PaymentPaginationMeta,
  RazorpayOrderApiResponse,
  RazorpayOrderData,
} from './responses/payment.response';
import { PaymentRecord } from '../repositories/types/payment.repository.types';

@Service()
@JsonController('/v1/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * @swagger
   * /api/v1/payments:
   *   post:
   *     summary: Record a payment transaction
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           example:
   *             libraryId: "6650a1b2c3d4e5f6a7b8c9d0"
   *             bookingId: "6650a1b2c3d4e5f6a7b8c9d1"
   *             orderId: "order_PNY9Dp1sAqxxy5"
   *             amount: 1500
   *             paymentMethod: "razorpay"
   *             transactionId: "pay_PNY9Dp1sAqxxy5"
   *             paymentStatus: "success"
   *             description: "Booking fee for Morning slot"
   */
  @Post('/')
  @HttpCode(201)
  @Authorized()
  public async createPayment(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() body: CreatePaymentRequest,
  ): Promise<PaymentApiResponse> {
    const payment = await this.paymentService.createPayment(session.user.id, {
      libraryId: body.libraryId,
      bookingId: body.bookingId,
      orderId: body.orderId,
      amount: body.amount,
      currency: body.currency,
      paymentMethod: body.paymentMethod,
      transactionId: body.transactionId,
      paymentStatus: body.paymentStatus,
      description: body.description,
      metadata: body.metadata,
    });
    return new PaymentApiResponse(this.mapPayment(payment), 201);
  }

  /**
   * @swagger
   * /api/v1/payments:
   *   get:
   *     summary: List payments (filterable)
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: libraryId
   *       - in: query
   *         name: paymentStatus
   *         schema: { enum: [pending, success, failed, refunded, cancelled] }
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   */
  @Get('/')
  @Authorized()
  public async listPayments(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @QueryParams() query: ListPaymentsQueryRequest,
  ): Promise<ListPaymentsApiResponse> {
    const result = await this.paymentService.listPayments({
      userId: session.user.id,
      libraryId: query.libraryId,
      paymentStatus: query.paymentStatus as any,
      paymentMethod: query.paymentMethod,
      page: query.page,
      limit: query.limit,
    });
    const meta = new PaymentPaginationMeta(query.page || 1, query.limit || 20, result.total);
    return new ListPaymentsApiResponse(result.payments.map(p => this.mapPayment(p)), meta);
  }

  /**
   * @swagger
   * /api/v1/payments/{id}:
   *   get:
   *     summary: Get payment by ID
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   */
  @Get('/:id')
  @Authorized()
  public async getPaymentById(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<PaymentApiResponse> {
    const payment = await this.paymentService.getPaymentById(id);
    return new PaymentApiResponse(this.mapPayment(payment));
  }

  /**
   * @swagger
   * /api/v1/payments/{id}/status:
   *   patch:
   *     summary: Update payment status
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           example:
   *             paymentStatus: "success"
   *             transactionId: "pay_PNY9Dp1sAqxxy5"
   */
  @Patch('/:id/status')
  @Authorized()
  public async updatePaymentStatus(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Param('id') id: string,
    @Body() body: UpdatePaymentStatusRequest,
  ): Promise<PaymentApiResponse> {
    const payment = await this.paymentService.updatePaymentStatus(id, {
      paymentStatus: body.paymentStatus,
      transactionId: body.transactionId,
      metadata: body.metadata,
    });
    return new PaymentApiResponse(this.mapPayment(payment));
  }

  /**
   * @swagger
   * /api/v1/payments/{id}:
   *   delete:
   *     summary: Delete a payment record
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   */
  @Delete('/:id')
  @Authorized('OWNER')
  public async deletePayment(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<DeletePaymentApiResponse> {
    await this.paymentService.deletePayment(id);
    return new DeletePaymentApiResponse(true);
  }

  // ─── Razorpay endpoints ─────────────────────────────────────────────────────

  /**
   * @swagger
   * /api/v1/payments/razorpay/create-order:
   *   post:
   *     summary: Create Razorpay order
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           example:
   *             amount: 1500
   *             receipt: "rcpt_booking_123"
   */
  @Post('/razorpay/create-order')
  @Authorized('STUDENT')
  public async createRazorpayOrder(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Body() body: CreateRazorpayOrderRequest,
  ): Promise<RazorpayOrderApiResponse> {
    try {
      const amountInPaise = Math.round(body.amount * 100);
      const receipt = body.receipt || `rcpt_${Date.now()}`;
      const result = await this.paymentService.createRazorpayOrder(amountInPaise, receipt);
      return new RazorpayOrderApiResponse(
        new RazorpayOrderData(result.orderId, result.amount, result.currency, result.keyId),
      );
    } catch (err: any) {
      throw new BadRequestError(err?.message || 'CREATE_ORDER_FAILED');
    }
  }

  /**
   * @swagger
   * /api/v1/payments/razorpay/verify:
   *   post:
   *     summary: Verify Razorpay payment signature
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           example:
   *             orderId: "order_PNY9Dp1sAqxxy5"
   *             paymentId: "pay_PNY9Dp1sAqxxy5"
   *             signature: "abc123..."
   */
  @Post('/razorpay/verify')
  @Authorized('STUDENT')
  public async verifyRazorpayPayment(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Body() body: VerifyRazorpayPaymentRequest,
  ) {
    const valid = this.paymentService.verifyRazorpaySignature(
      body.orderId,
      body.paymentId,
      body.signature,
    );
    if (!valid) {
      throw new BadRequestError('PAYMENT_SIGNATURE_INVALID');
    }
    return { responseCode: 200, data: { verified: true } };
  }

  private mapPayment(payment: PaymentRecord): PaymentData {
    return new PaymentData({
      id: payment.id,
      userId: payment.userId,
      libraryId: payment.libraryId,
      bookingId: payment.bookingId,
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      transactionId: payment.transactionId,
      paymentStatus: payment.paymentStatus,
      description: payment.description,
      metadata: payment.metadata,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    });
  }
}
