import {
  Authorized,
  CurrentUser,
  Get,
  HttpError,
  InternalServerError,
  JsonController,
  QueryParams,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { BannerService } from '../services/banner.service';
import { StudentBannerQueryRequest } from './requests/banner.request';
import { CurrentSessionData } from './responses/auth.response';
import {
  AnnouncementSummaryData,
  BannerData,
  BannerListApiResponse,
  BannerListPayloadData,
  MembershipAlertData,
} from './responses/banner.response';
import { ErrorResponseModel } from './responses/common.reponse';

@Service()
@JsonController('/v1/students/banners')
export class StudentBannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Get('/')
  @Authorized('STUDENT')
  @OpenAPI({
    summary: 'Get active sponsored banners and library announcements for students',
    security: [{ bearerAuth: [] }],
  })
  @ResponseSchema(BannerListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getActiveBanners(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @QueryParams() query: StudentBannerQueryRequest,
  ): Promise<BannerListApiResponse> {
    try {
      const studentId = session.user.id;

      // Always fetch global banners
      const bannerRecords = await this.bannerService.listActiveBanners();

      // Fetch announcements and membership alerts only if libraryId is provided
      const [announcementRecords, membershipAlerts] = query.libraryId
        ? await Promise.all([
            this.bannerService.listActiveAnnouncementsForStudent(studentId, query.libraryId),
            this.bannerService.getMembershipAlerts(studentId, query.libraryId),
          ])
        : [[], []];

      return new BannerListApiResponse(
        new BannerListPayloadData(
          bannerRecords.map(r => new BannerData(r)),
          announcementRecords.map(r => new AnnouncementSummaryData(r)),
          membershipAlerts.map(
            a =>
              new MembershipAlertData({
                type: a.type,
                title: a.title,
                message: a.message,
                endDate: a.endDate,
                daysRemaining: a.daysRemaining,
              }),
          ),
          bannerRecords.length,
        ),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_BANNERS_FAILED');
    }
  }
}