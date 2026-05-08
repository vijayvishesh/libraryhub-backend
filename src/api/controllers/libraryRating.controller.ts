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
import {
  LibraryRatingApiResponse,
  LibraryRatingData,
  LibraryRatingSummaryApiResponse,
  LibraryRatingSummaryData,
} from './responses/libraryRating.response';
import { ErrorResponseModel } from './responses/common.reponse';

@Service()
@JsonController('/v1/libraries')
export class LibraryRatingController {
  constructor(private readonly ratingService: LibraryRatingService) {}

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
      const record = await this.ratingService.rateLibrary(
        session.user.id,
        libraryId,
        payload,
      );
      return new LibraryRatingApiResponse(new LibraryRatingData(record), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('RATE_LIBRARY_FAILED');
    }
  }

  @Get('/:libraryId/rating')
  @OpenAPI({ summary: 'Get library rating summary' })
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
}