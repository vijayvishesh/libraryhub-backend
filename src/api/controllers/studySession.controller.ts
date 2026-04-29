import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  Get,
  HttpCode,
  HttpError,
  InternalServerError,
  JsonController,
  OnUndefined,
  Param,
  Post,
  Put,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { StudySessionService } from '../services/studySession.service';
import {
  CreateStudySessionRequest,
  UpdateStudySessionRequest,
} from './requests/studySession.request';
import { CurrentSessionData } from './responses/auth.response';
import { ErrorResponseModel } from './responses/common.reponse';
import {
  //   SessionLibraryData,
  StudySessionApiResponse,
  StudySessionData,
  StudySessionListApiResponse,
  StudySessionListPayloadData,
  StudySessionStatsApiResponse,
  StudySessionStatsData,
} from './responses/studySession.response';
// import { StudySessionRecord } from '../repositories/types/studySession.repository.types';

@Service()
@JsonController('/v1/students/sessions')
export class StudySessionController {
  constructor(private readonly studySessionService: StudySessionService) {}

  @Post('/')
  @Authorized('STUDENT')
  @HttpCode(201)
  @OpenAPI({ summary: 'Save a completed study session', security: [{ bearerAuth: [] }] })
  @ResponseSchema(StudySessionApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async createSession(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: CreateStudySessionRequest,
  ): Promise<StudySessionApiResponse> {
    try {
      const record = await this.studySessionService.createSession(session.user.id, payload);
      const library = await this.studySessionService.getLibraryDataForSession(record);
      return new StudySessionApiResponse(new StudySessionData(record, library), 201);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('CREATE_SESSION_FAILED');
    }
  }

  @Get('/')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'List all study sessions', security: [{ bearerAuth: [] }] })
  @ResponseSchema(StudySessionListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async listSessions(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<StudySessionListApiResponse> {
    try {
      const records = await this.studySessionService.listSessions(session.user.id);
      const sessions = await Promise.all(
        records.map(async record => {
          const library = await this.studySessionService.getLibraryDataForSession(record);
          return new StudySessionData(record, library);
        }),
      );
      return new StudySessionListApiResponse(
        new StudySessionListPayloadData(sessions, sessions.length),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('LIST_SESSIONS_FAILED');
    }
  }

  @Get('/stats')
  @Authorized('STUDENT')
  @OpenAPI({
    summary: 'Get study stats — total time, sessions, day streak',
    security: [{ bearerAuth: [] }],
  })
  @ResponseSchema(StudySessionStatsApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getStats(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<StudySessionStatsApiResponse> {
    try {
      const stats = await this.studySessionService.getStats(session.user.id);
      return new StudySessionStatsApiResponse(new StudySessionStatsData(stats), 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('GET_STATS_FAILED');
    }
  }

  @Get('/:id')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Get a specific study session by ID', security: [{ bearerAuth: [] }] })
  @ResponseSchema(StudySessionApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getSession(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<StudySessionApiResponse> {
    try {
      const record = await this.studySessionService.getSessionById(id, session.user.id);
      const library = await this.studySessionService.getLibraryDataForSession(record);
      return new StudySessionApiResponse(new StudySessionData(record, library), 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('GET_SESSION_FAILED');
    }
  }

  @Put('/:id')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Update session notes or revision reminder', security: [{ bearerAuth: [] }] })
  @ResponseSchema(StudySessionApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async updateSession(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('id') id: string,
    @Body() payload: UpdateStudySessionRequest,
  ): Promise<StudySessionApiResponse> {
    try {
      const record = await this.studySessionService.updateSession(id, session.user.id, payload);
      const library = await this.studySessionService.getLibraryDataForSession(record);
      return new StudySessionApiResponse(new StudySessionData(record, library), 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('UPDATE_SESSION_FAILED');
    }
  }

  @Delete('/:id')
  @Authorized('STUDENT')
  @OnUndefined(204)
  @OpenAPI({ summary: 'Delete a study session', security: [{ bearerAuth: [] }] })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async deleteSession(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<void> {
    try {
      await this.studySessionService.deleteSession(id, session.user.id);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('DELETE_SESSION_FAILED');
    }
  }
}
