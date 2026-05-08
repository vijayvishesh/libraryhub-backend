import {
  Authorized,
  Body,
  CurrentUser,
  HttpError,
  InternalServerError,
  JsonController,
  Param,
  Patch,
  Post,
  HttpCode,
  QueryParams,
  Get,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { AttendanceService } from '../services/attendance.service';
import { CheckInRequest, StudentAttendanceByIdQuery, StudentAttendanceHistoryQuery } from './requests/attendance.request';
import { CurrentSessionData } from './responses/auth.response';
import {
  AttendanceApiResponse,
  AttendanceData,
  AttendanceHistoryListApiResponse,
  AttendanceHistoryListPayloadData,
  StudentAttendanceByIdApiResponse,
  StudentAttendanceByIdPayloadData,
  StudentAttendanceStatsData,
//   AttendanceSummaryData,
//   TodayAttendanceApiResponse,
//   TodayAttendanceData,
} from './responses/attendance.response';
import { ErrorResponseModel } from './responses/common.reponse';

@Service()
@JsonController('/v1/students/attendance')
@OpenAPI({ tags: ['Attendance'] })
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('/checkin')
  @Authorized('STUDENT')
  @HttpCode(201)
  @OpenAPI({ summary: 'Check in to a library', security: [{ bearerAuth: [] }] })
  @ResponseSchema(AttendanceApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async checkIn(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: CheckInRequest,
  ): Promise<AttendanceApiResponse> {
    try {
      const record = await this.attendanceService.checkIn(session.user.id, payload.libraryId);
      return new AttendanceApiResponse(new AttendanceData(record), 201);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('CHECK_IN_FAILED');
    }
  }

  @Patch('/:id/checkout')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Check out from library', security: [{ bearerAuth: [] }] })
  @ResponseSchema(AttendanceApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async checkOut(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<AttendanceApiResponse> {
    try {
      const record = await this.attendanceService.checkOut(id, session.user.id);
      return new AttendanceApiResponse(new AttendanceData(record), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('CHECK_OUT_FAILED');
    }
  }

  @Patch('/:id/break')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Set status to on break', security: [{ bearerAuth: [] }] })
  @ResponseSchema(AttendanceApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async setOnBreak(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<AttendanceApiResponse> {
    try {
      const record = await this.attendanceService.setOnBreak(id, session.user.id);
      return new AttendanceApiResponse(new AttendanceData(record), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('SET_BREAK_FAILED');
    }
  }

  @Patch('/:id/resume')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Resume from break', security: [{ bearerAuth: [] }] })
  @ResponseSchema(AttendanceApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async resumeFromBreak(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<AttendanceApiResponse> {
    try {
      const record = await this.attendanceService.resumeFromBreak(id, session.user.id);
      return new AttendanceApiResponse(new AttendanceData(record), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('RESUME_FAILED');
    }
  }

@Get('/history')
@Authorized('STUDENT')
@OpenAPI({ summary: 'Get student attendance history', security: [{ bearerAuth: [] }] })
@ResponseSchema(AttendanceHistoryListApiResponse, { statusCode: 200 })
@ResponseSchema(ErrorResponseModel, { statusCode: 401 })
@ResponseSchema(ErrorResponseModel, { statusCode: 500 })
public async getMyAttendanceHistory(
  @CurrentUser({ required: true }) session: CurrentSessionData,
  @QueryParams() query: StudentAttendanceHistoryQuery,
): Promise<AttendanceHistoryListApiResponse> {
  try {
    const result = await this.attendanceService.getStudentAttendanceHistory(
      session.user.id,
      query.fromDate,
      query.toDate,
    );
    return new AttendanceHistoryListApiResponse(
      new AttendanceHistoryListPayloadData(
        result.records.map(r => new AttendanceData(r)),
        result.total,
      ),
      200,
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError('GET_ATTENDANCE_HISTORY_FAILED');
  }
}
@Get('/students/:studentId/history')
@Authorized('OWNER')
@OpenAPI({
  summary: 'Get attendance history of a student by ID with stats',
  security: [{ bearerAuth: [] }],
})
@ResponseSchema(StudentAttendanceByIdApiResponse, { statusCode: 200 })
@ResponseSchema(ErrorResponseModel, { statusCode: 401 })
@ResponseSchema(ErrorResponseModel, { statusCode: 404 })
@ResponseSchema(ErrorResponseModel, { statusCode: 500 })
public async getStudentAttendanceById(
  @CurrentUser({ required: true }) _session: CurrentSessionData,
  @Param('studentId') studentId: string,
  @QueryParams() query: StudentAttendanceByIdQuery,
): Promise<StudentAttendanceByIdApiResponse> {
  try {
    const result = await this.attendanceService.getStudentAttendanceById(
      studentId,
      {
        fromDate: query.fromDate,
        toDate:   query.toDate,
        page:     query.page,
        limit:    query.limit,
      },
    );

    return new StudentAttendanceByIdApiResponse(
      new StudentAttendanceByIdPayloadData({
        records: result.records.map(r => new AttendanceData(r)),
        total:   result.total,
        page:    result.page,
        limit:   result.limit,
        stats:   new StudentAttendanceStatsData(result.stats),
      }),
      200,
    );
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError('GET_STUDENT_ATTENDANCE_BY_ID_FAILED');
  }
}
}