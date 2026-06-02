import {
  Authorized,
  Body,
  CurrentUser,
  Get,
  HttpCode,
  HttpError,
  InternalServerError,
  JsonController,
  Param,
  Post,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { LibraryRatingService } from '../services/libraryRating.service';
import { RateLibraryRequest } from './requests/libraryRating.request';
import { CurrentSessionData } from './responses/auth.response';
import { ErrorResponseModel } from './responses/common.reponse';
import {
  LibraryRatingApiResponse,
  LibraryRatingData,
  LibraryRatingsListApiResponse,
  LibraryRatingSummaryApiResponse,
  LibraryRatingSummaryData,
} from './responses/libraryRating.response';

@Service()
@JsonController('/v1/libraries')
export class LibraryRatingController {
  constructor(private readonly ratingService: LibraryRatingService) {}

  // ── POST /:libraryId/rate ─────────────────────────────────────────────────

  @Post('/:libraryId/rate')
  @Authorized('STUDENT')
  @HttpCode(200)
  @OpenAPI({ summary: 'Rate a library — must be active member', security: [{ bearerAuth: [] }] })
  @ResponseSchema(LibraryRatingApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async rateLibrary(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('libraryId') libraryId: string,
    @Body() payload: RateLibraryRequest,
  ): Promise<LibraryRatingApiResponse> {
    try {
      const record = await this.ratingService.rateLibrary(session.user.id, libraryId, payload);
      return new LibraryRatingApiResponse(new LibraryRatingData(record), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('RATE_LIBRARY_FAILED');
    }
  }

  // ── GET /:libraryId/rating — summary only (average + count) ──────────────

  @Get('/:libraryId/rating')
  @OpenAPI({ summary: 'Get library rating summary (average + count)' })
  @ResponseSchema(LibraryRatingSummaryApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getLibraryRating(
    @Param('libraryId') libraryId: string,
  ): Promise<LibraryRatingSummaryApiResponse> {
    try {
      const summary = await this.ratingService.getLibraryRatingSummary(libraryId);
      return new LibraryRatingSummaryApiResponse(new LibraryRatingSummaryData(summary), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_LIBRARY_RATING_FAILED');
    }
  }

  // ── GET /:libraryId/ratings — full list with reviews ─────────────────────

  @Get('/:libraryId/ratings')
  @OpenAPI({ summary: 'Get all ratings with reviews for a library' })
  @ResponseSchema(LibraryRatingsListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getLibraryRatings(
    @Param('libraryId') libraryId: string,
  ): Promise<LibraryRatingsListApiResponse> {
    try {
      const records = await this.ratingService.getLibraryRatings(libraryId);
      return new LibraryRatingsListApiResponse(
        records.map(r => new LibraryRatingData(r)),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_LIBRARY_RATINGS_FAILED');
    }
  }

  // ── GET /:libraryId/ratings/my — student's own rating ────────────────────

  @Get('/:libraryId/ratings/my')
  @Authorized('STUDENT')
  @OpenAPI({
    summary: "Get the student's own rating for a library",
    security: [{ bearerAuth: [] }],
  })
  @ResponseSchema(LibraryRatingApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getMyRating(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('libraryId') libraryId: string,
  ): Promise<LibraryRatingApiResponse | { responseCode: number; data: null }> {
    try {
      const record = await this.ratingService.getMyRating(session.user.id, libraryId);
      if (!record) return { responseCode: 200, data: null };
      return new LibraryRatingApiResponse(new LibraryRatingData(record), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_MY_RATING_FAILED');
    }
  }
}