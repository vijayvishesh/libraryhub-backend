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
import { StudyInsightsService } from '../services/studyInsights.service';
import { CurrentSessionData } from './responses/auth.response';
import { ErrorResponseModel } from './responses/common.reponse';
import { StudyInsightsApiResponse, StudyInsightsData } from './responses/studyInsights.response';

@Service()
@JsonController('/v1/students/insights')
export class StudyInsightsController {
  constructor(private readonly studyInsightsService: StudyInsightsService) {}

  @Get('/')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Get study insights — today hours, streak, week hours, graph, recent sessions', security: [{ bearerAuth: [] }] })
  @ResponseSchema(StudyInsightsApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getInsights(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<StudyInsightsApiResponse> {
    try {
      const insights = await this.studyInsightsService.getInsights(session.user.id);
      return new StudyInsightsApiResponse(new StudyInsightsData(insights), 200);
    } catch (error) {
        console.error('GET_INSIGHTS_ERROR:', error);
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_INSIGHTS_FAILED');
    }
  }
}