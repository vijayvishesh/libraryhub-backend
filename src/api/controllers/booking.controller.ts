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
  // Patch,
  Post,
  QueryParam,
  QueryParams,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { BookingResult, BookingService } from '../services/booking.service';
import { CreateBookingRequest, ListMyBookingsQueryRequest, RenewBookingRequest, UpdateBookingPaymentRequest } from './requests/booking.request';
import { CurrentSessionData } from './responses/auth.response';
import {
  AppUpdateStatusData,
  BookingCreateApiResponse,
  BookingData,
  BookingDetailApiResponse,
  BookingListApiResponse,
  BookingListPayloadData,
} from './responses/booking.response';
import { ErrorResponseModel } from './responses/common.reponse';
import { AppVersionService } from '../services/appVersion.service';
import { AppOs } from '../models/appVersion.model';

@Service()
@JsonController('/v1/bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService, private readonly appVersionService: AppVersionService,) {}

  @Post('/')
  @Authorized('STUDENT')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(BookingCreateApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 403 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async createBooking(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: CreateBookingRequest,
  ): Promise<BookingCreateApiResponse> {
    try {
      const booking = await this.bookingService.createBooking(session.user.id, payload);
      return new BookingCreateApiResponse(this.mapBookingData(booking), 201);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('CREATE_BOOKING_FAILED');
    }
  }

  @Get('/my')
  @Authorized('STUDENT')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(BookingListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async listMyBookings(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @QueryParams() query: ListMyBookingsQueryRequest,
    @QueryParam('platform') platform?: string,
    @QueryParam('appVersion') appVersion?: string,
    @QueryParam('deviceId') deviceId?: string,
  ): Promise<BookingListApiResponse> {
    try {
      const result = await this.bookingService.listMyBookings(session.user.id, query);
       let appUpdate: AppUpdateStatusData | null = null;
      if (platform && appVersion && deviceId) {
        try {
          const status = await this.appVersionService.checkUpdateStatus(
            session.user.id,
            'STUDENT',
            platform as AppOs,
            appVersion,
            deviceId,
          );
          appUpdate = new AppUpdateStatusData(status);
        } catch {
          // non-critical — don't fail the booking response
        }}
      return new BookingListApiResponse(
        new BookingListPayloadData(
          result.bookings.map(item => this.mapBookingData(item)),
          result.page,
          result.limit,
          result.total,
          result.todayStudyTime,
          appUpdate,  
        ),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GET_MY_BOOKINGS_FAILED');
    }
  }

  @Get('/:bookingId')
  @Authorized('STUDENT')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(BookingDetailApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getMyBookingById(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('bookingId') bookingId: string,
  ): Promise<BookingDetailApiResponse> {
    try {
      const booking = await this.bookingService.getMyBookingById(session.user.id, bookingId);
      return new BookingDetailApiResponse(this.mapBookingData(booking), 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GET_MY_BOOKING_FAILED');
    }
  }

  private mapBookingData(params: BookingResult): BookingData {
    return new BookingData({
      id: params.id,
      libraryId: params.libraryId,
      libraryName: params.libraryName,
      seatId: params.seatId,
      slotId: params.slotId,
      slotName: params.slotName,
      time: params.time,
      sectionId: params.sectionId,
      paymentMethod: params.paymentMethod,
      amount: params.amount,
      date: params.date,
      validUntil: params.validUntil,
      status: params.status,
      invoiceNo: params.invoiceNo,
      libraryAddress: params.libraryAddress,
      libraryCity: params.libraryCity,
      libraryState: params.libraryState,
      libraryPincode: params.libraryPincode,
      libraryLatitude: params.libraryLatitude,
      libraryLongitude: params.libraryLongitude,
      duration: params.duration,
      todayStudyTime: params.todayStudyTime,
      todayAttendance: params.todayAttendance, 
      libraryStatus: params.libraryStatus,
      libraryUsage: params.libraryUsage,
    });
  }
@Post('/renew')
@Authorized()
@OpenAPI({ security: [{ bearerAuth: [] }] })
@ResponseSchema(BookingCreateApiResponse, { statusCode: 201 })
@ResponseSchema(ErrorResponseModel, { statusCode: 400 })
@ResponseSchema(ErrorResponseModel, { statusCode: 409 })
public async renewMembership(
  @CurrentUser({ required: true }) session: CurrentSessionData,
  @Body() payload: RenewBookingRequest,
): Promise<BookingCreateApiResponse> {
  try {
    const booking = await this.bookingService.renewMembership(session.user.id, payload);
    return new BookingCreateApiResponse(this.mapBookingData(booking), 201);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError('RENEW_MEMBERSHIP_FAILED');
  }
}
// @Patch('/avatar')
// @Authorized('STUDENT')
// public async updateAvatar(
//   @CurrentUser({ required: true }) session: CurrentSessionData,
//   @Body() payload: UpdateStudentAvatarRequest,
// ): Promise<any> {
//   // await this.memberService.updateStudentAvatar(session.user.id, payload.avatarUrl);
//   return { responseCode: 200, message: 'Avatar updated successfully' };
// }

@Patch('/:bookingId/payment')
@Authorized('STUDENT')
@OpenAPI({ summary: 'Update payment method or screenshot on existing booking', security: [{ bearerAuth: [] }] })
@ResponseSchema(BookingDetailApiResponse, { statusCode: 200 })
@ResponseSchema(ErrorResponseModel, { statusCode: 400 })
@ResponseSchema(ErrorResponseModel, { statusCode: 404 })
@ResponseSchema(ErrorResponseModel, { statusCode: 409 })
public async updateBookingPayment(
  @CurrentUser({ required: true }) session: CurrentSessionData,
  @Param('bookingId') bookingId: string,
  @Body() payload: UpdateBookingPaymentRequest,
): Promise<BookingDetailApiResponse> {
  try {
    const booking = await this.bookingService.updateBookingPayment(
      session.user.id,
      bookingId,
      payload.paymentMethod,
      payload.paymentScreenshotUrl ?? null,
    );
    return new BookingDetailApiResponse(this.mapBookingData(booking), 200);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError('UPDATE_BOOKING_PAYMENT_FAILED');
  }
}
}
