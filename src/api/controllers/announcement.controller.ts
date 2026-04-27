import {
  Authorized,
  Body,
  CurrentUser,
  Get,
  HttpCode,
  HttpError,
  InternalServerError,
  JsonController,
  Post,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { AnnouncementService } from '../services/announcement.service';
import { CreateAnnouncementRequest } from './requests/announcement.request';
import { CurrentSessionData } from './responses/auth.response';
import {
  AnnouncementApiResponse,
  AnnouncementData,
  AnnouncementListApiResponse,
  AnnouncementListPayloadData,
} from './responses/announcement.response';
import { ErrorResponseModel } from './responses/common.reponse';

@Service()
@JsonController('/v1/owner/announcements')
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Post('/')
  @Authorized('OWNER')
  @HttpCode(201)
  @OpenAPI({ summary: 'Create and send announcement to targeted members', security: [{ bearerAuth: [] }] })
  @ResponseSchema(AnnouncementApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async createAnnouncement(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: CreateAnnouncementRequest,
  ): Promise<AnnouncementApiResponse> {
    try {
      const record = await this.announcementService.createAnnouncement(
        session.user.id,
        payload,
      );
      return new AnnouncementApiResponse(new AnnouncementData(record), 201);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('CREATE_ANNOUNCEMENT_FAILED');
    }
  }

  @Get('/')
  @Authorized('OWNER')
  @OpenAPI({ summary: 'List all announcements for owner library', security: [{ bearerAuth: [] }] })
  @ResponseSchema(AnnouncementListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async listAnnouncements(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<AnnouncementListApiResponse> {
    try {
      const records = await this.announcementService.listAnnouncements(session.user.id);
      return new AnnouncementListApiResponse(
        new AnnouncementListPayloadData(
          records.map(r => new AnnouncementData(r)),
          records.length,
        ),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('LIST_ANNOUNCEMENTS_FAILED');
    }
  }
}