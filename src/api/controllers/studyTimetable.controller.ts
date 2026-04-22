import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  Get,
  HttpError,
  InternalServerError,
  JsonController,
  OnUndefined,
  Param,
  Put,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { StudyTimetableService } from '../services/studyTimetable.service';
import { UpdateStudyTimetableRequest } from './requests/studyTimetable.request';
import { CurrentSessionData } from './responses/auth.response';
import { Post, HttpCode } from 'routing-controllers';
import { CreateStudyTimetableRequest } from './requests/studyTimetable.request';
import {
  StudyTimetableApiResponse,
  StudyTimetableData,
  StudyTimetableListApiResponse,
  StudyTimetableListPayloadData,
} from './responses/studyTimetable.response';
import { ErrorResponseModel } from './responses/common.reponse';
import { StudyTimetableRecord } from '../repositories/types/studyTimetable.repository.types';

@Service()
@JsonController('/v1/students/timetables')
export class StudyTimetableController {
  constructor(private readonly studyTimetableService: StudyTimetableService) {}

  @Get('/')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'List all study timetables for logged-in student', security: [{ bearerAuth: [] }] })
  @ResponseSchema(StudyTimetableListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async listTimetables(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<StudyTimetableListApiResponse> {
    try {
      const records = await this.studyTimetableService.listAllStudentTimetables(session.user.id);
      return new StudyTimetableListApiResponse(
        new StudyTimetableListPayloadData(records.map(this.mapTimetableData), records.length),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('LIST_TIMETABLES_FAILED');
    }
  }

  @Get('/:id')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Get a specific study timetable by ID', security: [{ bearerAuth: [] }] })
  @ResponseSchema(StudyTimetableApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getTimetable(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<StudyTimetableApiResponse> {
    try {
      const record = await this.studyTimetableService.getTimetableById(id, session.user.id);
      return new StudyTimetableApiResponse(this.mapTimetableData(record), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_TIMETABLE_FAILED');
    }
  }
  @Post('/')
@Authorized('STUDENT')
@HttpCode(201)
@OpenAPI({ summary: 'Create a new study timetable', security: [{ bearerAuth: [] }] })
@ResponseSchema(StudyTimetableApiResponse, { statusCode: 201 })
@ResponseSchema(ErrorResponseModel, { statusCode: 400 })
@ResponseSchema(ErrorResponseModel, { statusCode: 401 })
@ResponseSchema(ErrorResponseModel, { statusCode: 500 })
public async createTimetable(
  @CurrentUser({ required: true }) session: CurrentSessionData,
  @Body() payload: CreateStudyTimetableRequest,
): Promise<StudyTimetableApiResponse> {
  try {
    const record = await this.studyTimetableService.createTimetable(session.user.id, payload);
    return new StudyTimetableApiResponse(this.mapTimetableData(record), 201);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError('CREATE_TIMETABLE_FAILED');
  }
}
  @Put('/:id')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Update a study timetable', security: [{ bearerAuth: [] }] })
  @ResponseSchema(StudyTimetableApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async updateTimetable(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('id') id: string,
    @Body() payload: UpdateStudyTimetableRequest,
  ): Promise<StudyTimetableApiResponse> {
    try {
      const record = await this.studyTimetableService.updateTimetable(id, session.user.id, payload);
      return new StudyTimetableApiResponse(this.mapTimetableData(record), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('UPDATE_TIMETABLE_FAILED');
    }
  }

  @Delete('/:id')
  @Authorized('STUDENT')
  @OnUndefined(204)
  @OpenAPI({ summary: 'Delete a study timetable', security: [{ bearerAuth: [] }] })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async deleteTimetable(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<void> {
    try {
      await this.studyTimetableService.deleteTimetable(id, session.user.id);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('DELETE_TIMETABLE_FAILED');
    }
  }

  private mapTimetableData(record: StudyTimetableRecord): StudyTimetableData {
    return new StudyTimetableData(record);
  }
}