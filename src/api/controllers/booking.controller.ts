import {
  Authorized,
  Body,
  CurrentUser,
  Get,
  HttpError,
  InternalServerError,
  JsonController,
  Param,
  Post,
  QueryParams,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { BookingService, BookingResult } from '../services/booking.service';
import { CreateBookingRequest, ListMyBookingsQueryRequest } from './requests/booking.request';
import { CurrentSessionData } from './responses/auth.response';
import {
  BookingCreateApiResponse,
  BookingData,
  BookingDetailApiResponse,
  BookingListApiResponse,
  BookingListPayloadData,
} from './responses/booking.response';
import { ErrorResponseModel } from './responses/common.reponse';

@Service()
@JsonController('/v1/bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

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
  ): Promise<BookingListApiResponse> {
    try {
      const result = await this.bookingService.listMyBookings(session.user.id, query);
      return new BookingListApiResponse(
        new BookingListPayloadData(
          result.bookings.map(item => this.mapBookingData(item)),
          result.page,
          result.limit,
          result.total,
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
    });
  }
}