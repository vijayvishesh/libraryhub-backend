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
import { AttendanceService } from '../services/attendance.service';
import { CurrentSessionData } from './responses/auth.response';
import {
  AttendanceData,
  AttendanceSummaryData,
  TodayAttendanceApiResponse,
  TodayAttendanceData,
} from './responses/attendance.response';
import { ErrorResponseModel } from './responses/common.reponse';

@Service()
@JsonController('/v1/owner/attendance')
@OpenAPI({ tags: ['Attendance'] })
export class OwnerAttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('/today')
  @Authorized('OWNER')
  @OpenAPI({ summary: 'Get today attendance for owner library', security: [{ bearerAuth: [] }] })
  @ResponseSchema(TodayAttendanceApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getTodayAttendance(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<TodayAttendanceApiResponse> {
    try {
      const result = await this.attendanceService.getTodayAttendanceForOwner(session.user.id);
      return new TodayAttendanceApiResponse(
        new TodayAttendanceData(
          result.records.map(r => new AttendanceData(r)),
          new AttendanceSummaryData({
            present: result.present,
            onBreak: result.onBreak,
            absent: result.absent,
          }),
          result.records.length,
        ),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_TODAY_ATTENDANCE_FAILED');
    }
  }
}