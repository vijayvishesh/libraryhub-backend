import {
  Authorized,
  Body,
  CurrentUser,
  Get,
  HttpError,
  InternalServerError,
  JsonController,
  Post,
  QueryParams,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { ActivityService } from '../services/activity.service';
import { LibraryService } from '../services/library.service';
import { LibraryListQueryRequest, LibrarySetupRequest } from './requests/library.request';
import { CurrentSessionData } from './responses/auth.response';
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

  @Get('/')
  @ResponseSchema(ListedLibrariesApiResponse, { statusCode: 200 })
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
}
