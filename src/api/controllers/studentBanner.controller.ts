import {
  Authorized,
  CurrentUser,
  Get,
  HttpError,
  InternalServerError,
  JsonController,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { BannerService } from '../services/banner.service';
import { CurrentSessionData } from './responses/auth.response';
import {
  BannerData,
  BannerListApiResponse,
  BannerListPayloadData,
} from './responses/banner.response';
import { ErrorResponseModel } from './responses/common.reponse';

@Service()
@JsonController('/v1/students/banners')
export class StudentBannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Get('/')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Get active sponsored banners for students', security: [{ bearerAuth: [] }] })
  @ResponseSchema(BannerListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getActiveBanners(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
  ): Promise<BannerListApiResponse> {
    try {
      const records = await this.bannerService.listActiveBanners();
      return new BannerListApiResponse(
        new BannerListPayloadData(records.map(r => new BannerData(r)), records.length),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_BANNERS_FAILED');
    }
  }
}