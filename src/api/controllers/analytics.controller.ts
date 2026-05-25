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
import { AnalyticsQueryRequest } from './requests/analytics.request';
import { AnalyticsService } from '../services/analytics.service';
import { CurrentSessionData } from './responses/auth.response';
import { ErrorResponseModel } from './responses/common.reponse';
import {
  AnalyticsApiResponse,
  AnalyticsPayloadData,
} from './responses/analytics.response';

@Service()
@JsonController('/v1/owner/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // GET /api/v1/owner/analytics?range=today|week|month|year
  @Get('/')
  @Authorized('OWNER')
  @OpenAPI({
    summary: 'Get library analytics — summary + chart data',
    description: 'range: today | week | month | year (default: month)',
    security: [{ bearerAuth: [] }],
  })
  @ResponseSchema(AnalyticsApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getAnalytics(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @QueryParams() query: AnalyticsQueryRequest,
  ): Promise<AnalyticsApiResponse> {
    try {
      const range = query.range ?? 'month';
      const result = await this.analyticsService.getAnalytics(session.user.id, range);
      const payload = Object.assign(new AnalyticsPayloadData(), result);
      return new AnalyticsApiResponse(payload, 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_ANALYTICS_FAILED');
    }
  }
}