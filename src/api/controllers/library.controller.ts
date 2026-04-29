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
import { ActivityService } from '../services/activity.service';
import { BookingService } from '../services/booking.service';
import { LibraryService } from '../services/library.service';
import { LibrarySeatMapQueryRequest } from './requests/booking.request';
import {
  LibraryListQueryRequest,
  LibrarySetupRequest,
  UpdateLibraryRequest,
} from './requests/library.request';
import { CurrentSessionData } from './responses/auth.response';
import {
  LibraryPaymentOptionData,
  LibraryPaymentOptionsApiResponse,
  OwnerSeatOverviewApiResponse,
  OwnerSeatOverviewData,
  SeatMapApiResponse,
  SeatMapData,
  SeatMapSeatData,
} from './responses/booking.response';
import { ErrorResponseModel } from './responses/common.reponse';
import {
  LibrarySetupApiResponse,
  ListedLibrariesApiResponse,
  PaginationMetaData,
} from './responses/library.response';

@Service()
@JsonController('/v1/libraries')
export class LibraryController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly bookingService: BookingService,
    private readonly activityService: ActivityService,
  ) {}

  @Get('/my')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(LibrarySetupApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getMyLibrary(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<LibrarySetupApiResponse> {
    try {
      const data = await this.libraryService.getLibraryByOwnerId(session.user.id);
      return new LibrarySetupApiResponse(data, 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GET_MY_LIBRARY_FAILED');
    }
  }

  @Get('/my/seats')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(OwnerSeatOverviewApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getMyLibrarySeatOverview(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @QueryParams() query: LibrarySeatMapQueryRequest,
  ): Promise<OwnerSeatOverviewApiResponse> {
    try {
      const library = await this.libraryService.getLibraryByOwnerId(session.user.id);
      const seatMap = await this.bookingService.getLibrarySeatMap(
        library.id,
        query.slotId,
        query.sectionId,
      );
      const mappedSeats = seatMap.seats.map(item => new SeatMapSeatData(item));
      const occupiedSeats = seatMap.seats.filter(item => item.seatStatus === 'occupied').length;
      const pendingSeats = seatMap.seats.filter(item => item.seatStatus === 'pending').length;
      const totalSeats = seatMap.seats.length;

      return new OwnerSeatOverviewApiResponse(
        new OwnerSeatOverviewData({
          libraryId: seatMap.libraryId,
          slotId: seatMap.slotId,
          sectionId: seatMap.sectionId,
          totalSeats,
          occupiedSeats,
          pendingSeats,
          availableSeats: totalSeats - occupiedSeats - pendingSeats,
          seats: mappedSeats,
        }),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GET_MY_LIBRARY_SEAT_OVERVIEW_FAILED');
    }
  }

  @Get('/')
  @Authorized('STUDENT')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(ListedLibrariesApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async listLibraries(
    @QueryParams() query: LibraryListQueryRequest,
  ): Promise<ListedLibrariesApiResponse> {
    try {
      const result = await this.libraryService.getListedLibraries(query);
      return new ListedLibrariesApiResponse(
        result.libraries,
        new PaginationMetaData(result.page, result.limit, result.total),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('LIST_LIBRARIES_FAILED');
    }
  }

  @Get('/:libraryId')
  @Authorized('STUDENT')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(LibrarySetupApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getLibraryById(
    @Param('libraryId') libraryId: string,
  ): Promise<LibrarySetupApiResponse> {
    try {
      const data = await this.libraryService.getLibraryById(libraryId);
      return new LibrarySetupApiResponse(data, 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GET_LIBRARY_BY_ID_FAILED');
    }
  }

  @Get('/:libraryId/seats')
  @Authorized('STUDENT')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(SeatMapApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getLibrarySeatMap(
    @Param('libraryId') libraryId: string,
    @QueryParams() query: LibrarySeatMapQueryRequest,
  ): Promise<SeatMapApiResponse> {
    try {
      const seatMap = await this.bookingService.getLibrarySeatMap(
        libraryId,
        query.slotId,
        query.sectionId,
      );

      return new SeatMapApiResponse(
        new SeatMapData({
          libraryId: seatMap.libraryId,
          slotId: seatMap.slotId,
          sectionId: seatMap.sectionId,
          seats: seatMap.seats.map(item => new SeatMapSeatData(item)),
        }),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GET_LIBRARY_SEAT_MAP_FAILED');
    }
  }

  @Get('/:libraryId/payment-methods')
  @Authorized('STUDENT')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(LibraryPaymentOptionsApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getLibraryPaymentMethods(
    @Param('libraryId') libraryId: string,
  ): Promise<LibraryPaymentOptionsApiResponse> {
    try {
      const methods = await this.bookingService.getLibraryPaymentOptions(libraryId);
      return new LibraryPaymentOptionsApiResponse(
        methods.map(
          method => new LibraryPaymentOptionData(method.type, method.label, method.enabled),
        ),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GET_LIBRARY_PAYMENT_METHODS_FAILED');
    }
  }

  @Post('/')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(LibrarySetupApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async createLibrary(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: LibrarySetupRequest,
  ): Promise<LibrarySetupApiResponse> {
    try {
      const data = await this.libraryService.setupLibrary(session.user.id, payload);

      // Log the activity
      await this.activityService.logActivity(
        session.user.id,
        'LIBRARY_CREATED',
        `User created a new library: ${data.name}`,
        { libraryId: data.id, libraryName: data.name },
      );

      return new LibrarySetupApiResponse(data, 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('CREATE_LIBRARY_FAILED');
    }
  }

  @Patch('/my')
  @Authorized('OWNER')
  @OpenAPI({ summary: 'Update library details', security: [{ bearerAuth: [] }] })
  @ResponseSchema(LibrarySetupApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async updateLibrary(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: UpdateLibraryRequest,
  ): Promise<LibrarySetupApiResponse> {
    try {
      const data = await this.libraryService.updateLibrary(session.user.id, payload);

      await this.activityService.logActivity(
        session.user.id,
        'LIBRARY_UPDATED',
        `User updated library: ${data.name}`,
        { libraryId: data.id, libraryName: data.name },
      );

      return new LibrarySetupApiResponse(data, 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('UPDATE_LIBRARY_FAILED');
    }
  }

  @Delete('/my')
  @Authorized('OWNER')
  @OpenAPI({ summary: 'Delete library (soft delete)', security: [{ bearerAuth: [] }] })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async deleteLibrary(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<{ responseCode: number; message: string }> {
    try {
      await this.libraryService.deleteLibrary(session.user.id);

      return { responseCode: 200, message: 'Library deleted successfully' };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('DELETE_LIBRARY_FAILED');
    }
  }
}
