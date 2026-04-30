import { Response } from 'express';
import * as multer from 'multer';
import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  Get,
  HttpError,
  InternalServerError,
  JsonController,
  Param,
  Patch,
  Post,
  QueryParams,
  Res,
  UploadedFile,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { sendXlsxDownload } from '../helpers/excel.helper';
import { ActivityService } from '../services/activity.service';
import { BookingApprovalService } from '../services/bookingApproval.service';
import { FeeCollectionService } from '../services/feeCollection.service';
import { MemberService } from '../services/member.service';
import { OwnerService } from '../services/owner.service';
import { MarkBookingPaidRequest, OwnerFeeCollectionQueryRequest } from './requests/booking.request';
import {
  AddMemberRequest,
  GenerateMemberInviteLinkRequest,
  ListMembersQueryRequest,
  ListMemberUploadsQueryRequest,
  UpdateMemberRequest,
} from './requests/member.request';
import { CurrentSessionData } from './responses/auth.response';
import {
  OwnerFeeCollectionApiResponse,
  OwnerFeeCollectionItemData,
  OwnerFeeCollectionPayloadData,
  OwnerFeeCollectionSummaryData,
} from './responses/booking.response';
import { ErrorResponseModel } from './responses/common.reponse';
import {
  MemberActionApiResponse,
  MemberCreateApiResponse,
  MemberData,
  MemberDetailApiResponse,
  MemberInviteLinkApiResponse,
  MemberInviteLinkData,
  MemberListApiResponse,
  MemberListPayloadData,
  MemberUploadData,
  MemberUploadListApiResponse,
  MemberUploadListPayloadData,
} from './responses/member.response';
import {
  OwnerDashboardAlertsData,
  OwnerDashboardApiResponse,
  OwnerDashboardData,
  OwnerDashboardLibraryData,
  OwnerDashboardRecentActivityData,
  OwnerDashboardRevenueData,
  OwnerDashboardSeatsData,
} from './responses/owner.response';

@Service()
@JsonController('/owner')
export class OwnerController {
  constructor(
    private readonly ownerService: OwnerService,
    private readonly feeCollectionService: FeeCollectionService,
    private readonly memberService: MemberService,
    private readonly activityService: ActivityService,
    private readonly bookingApprovalService: BookingApprovalService,
  ) {}

  @Get('/fee-collection')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(OwnerFeeCollectionApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getFeeCollection(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @QueryParams() query: OwnerFeeCollectionQueryRequest,
  ): Promise<OwnerFeeCollectionApiResponse> {
    try {
      const result = await this.feeCollectionService.getOwnerFeeCollection(session.user.id, query);

      return new OwnerFeeCollectionApiResponse(
        new OwnerFeeCollectionPayloadData({
          summary: new OwnerFeeCollectionSummaryData(result.summary),
          tab: result.tab,
          items: result.items.map(item => new OwnerFeeCollectionItemData(item)),
          page: result.page,
          limit: result.limit,
          total: result.total,
        }),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GET_OWNER_FEE_COLLECTION_FAILED');
    }
  }

  @Patch('/bookings/:bookingId/approve')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async approveBooking(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('bookingId') bookingId: string,
  ): Promise<{ responseCode: number; message: string }> {
    try {
      const result = await this.bookingApprovalService.approveBooking(session.user.id, bookingId);

      await this.activityService.logActivity(
        session.user.id,
        'BOOKING_APPROVED',
        `Booking approved for seat ${result.seatId}`,
        {
          bookingId: result.id,
          seatId: result.seatId,
          amount: result.amount,
        },
      );

      return { responseCode: 200, message: 'BOOKING_APPROVED' };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('APPROVE_BOOKING_FAILED');
    }
  }

  @Patch('/bookings/:bookingId/reject')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async rejectBooking(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('bookingId') bookingId: string,
  ): Promise<{ responseCode: number; message: string }> {
    try {
      const result = await this.bookingApprovalService.rejectBooking(session.user.id, bookingId);

      await this.activityService.logActivity(
        session.user.id,
        'BOOKING_REJECTED',
        `Booking rejected for seat ${result.seatId}`,
        {
          bookingId: result.id,
          seatId: result.seatId,
        },
      );

      return { responseCode: 200, message: 'BOOKING_REJECTED' };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('REJECT_BOOKING_FAILED');
    }
  }

  @Get('/dashboard')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(OwnerDashboardApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getDashboard(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<OwnerDashboardApiResponse> {
    try {
      const dashboard = await this.ownerService.getDashboard(session.user.id);
      return new OwnerDashboardApiResponse(
        new OwnerDashboardData({
          library: new OwnerDashboardLibraryData(
            dashboard.library.name,
            dashboard.library.location,
            dashboard.library.capacity,
          ),
          revenue: new OwnerDashboardRevenueData(
            dashboard.revenue.today,
            dashboard.revenue.todayChange,
            dashboard.revenue.monthly,
          ),
          seats: new OwnerDashboardSeatsData(
            dashboard.seats.total,
            dashboard.seats.occupied,
            dashboard.seats.pending,
            dashboard.seats.free,
          ),
          alerts: new OwnerDashboardAlertsData(
            dashboard.alerts.overdue,
            dashboard.alerts.expiringSoon,
          ),
          recentActivity: dashboard.recentActivity.map(
            item =>
              new OwnerDashboardRecentActivityData({
                id: item.id,
                name: item.name,
                action: item.action,
                detail: item.detail,
                time: item.time,
                color: item.color,
              }),
          ),
        }),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GET_OWNER_DASHBOARD_FAILED');
    }
  }

  @Get('/members')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(MemberListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async listMembers(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @QueryParams() query: ListMembersQueryRequest,
  ): Promise<MemberListApiResponse> {
    try {
      const result = await this.memberService.listMembers(session.user.id, query);
      return new MemberListApiResponse(
        new MemberListPayloadData(
          result.members.map(item => new MemberData(item)),
          result.page,
          result.limit,
          result.total,
        ),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('LIST_OWNER_MEMBERS_FAILED');
    }
  }

  @Get('/members/upload-template')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async downloadMemberUploadTemplate(@Res() res: Response): Promise<Response> {
    try {
      const result = await this.memberService.downloadMemberTemplate();
      return sendXlsxDownload(res, result.filename, result.buffer);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('DOWNLOAD_MEMBER_UPLOAD_TEMPLATE_FAILED');
    }
  }

  @Post('/members/upload')
  @Authorized('OWNER')
  @OpenAPI({
    security: [{ bearerAuth: [] }],
    requestBody: {
      required: true,
      content: {
        ['multipart/form-data']: {
          schema: {
            type: 'object',
            required: ['file'],
            properties: {
              file: {
                type: 'string',
                format: 'binary',
              },
            },
          },
        },
      },
    },
  })
  @ResponseSchema(MemberActionApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async uploadMembersExcel(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @UploadedFile('file', {
      required: true,
      options: {
        storage: multer.memoryStorage(),
        limits: {
          fileSize: 5 * 1024 * 1024,
        },
      },
    })
    file: { originalname: string; buffer: Buffer },
  ): Promise<MemberActionApiResponse> {
    try {
      const upload = await this.memberService.uploadMembersExcel(session.user.id, file);
      if (upload.failedCount > 0) {
        const firstFailedRow = upload.rows.find(row => row.uploadStatus === 'failed');
        const errorMessage = firstFailedRow?.errorMessage || 'MEMBER_UPLOAD_FAILED';
        const formattedErrorMessage = firstFailedRow
          ? `Row ${firstFailedRow.rowNumber}: ${errorMessage}`
          : errorMessage;

        if (upload.successCount > 0) {
          throw new HttpError(
            400,
            `Uploaded ${upload.successCount} rows successfully, ${upload.failedCount} failed. ${formattedErrorMessage}`,
          );
        }

        throw new HttpError(400, formattedErrorMessage);
      }

      return new MemberActionApiResponse('MEMBER_UPLOAD_PROCESSED', 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('UPLOAD_OWNER_MEMBERS_FAILED');
    }
  }

  @Get('/members/uploads')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(MemberUploadListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async listMemberUploads(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @QueryParams() query: ListMemberUploadsQueryRequest,
  ): Promise<MemberUploadListApiResponse> {
    try {
      const result = await this.memberService.listMemberUploads(session.user.id, query);
      return new MemberUploadListApiResponse(
        new MemberUploadListPayloadData(
          result.uploads.map(item => new MemberUploadData(item)),
          result.page,
          result.limit,
          result.total,
        ),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('LIST_MEMBER_UPLOADS_FAILED');
    }
  }

  @Get('/members/uploads/:uploadId/report')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async downloadMemberUploadReport(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('uploadId') uploadId: string,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      const result = await this.memberService.downloadMemberUploadReport(session.user.id, uploadId);
      return sendXlsxDownload(res, result.filename, result.buffer);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('DOWNLOAD_MEMBER_UPLOAD_REPORT_FAILED');
    }
  }

  @Post('/members')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(MemberCreateApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async addMember(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: AddMemberRequest,
  ): Promise<MemberCreateApiResponse> {
    try {
      const result = await this.memberService.addMember(session.user.id, payload);

      await this.activityService.logActivity(
        session.user.id,
        'NEW_MEMBER_ADDED',
        `New member added: ${payload.fullName}`,
        {
          memberName: payload.fullName,
          memberPhone: payload.mobileNo,
          seatId: payload.seatId,
        },
      );

      return new MemberCreateApiResponse(result.msg, 201);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('ADD_OWNER_MEMBER_FAILED');
    }
  }

  @Get('/members/:memberId')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(MemberDetailApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getMemberById(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('memberId') memberId: string,
  ): Promise<MemberDetailApiResponse> {
    try {
      const member = await this.memberService.getMemberById(session.user.id, memberId);
      return new MemberDetailApiResponse(new MemberData(member), 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GET_OWNER_MEMBER_FAILED');
    }
  }

  @Patch('/members/:memberId')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(MemberDetailApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async updateMember(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('memberId') memberId: string,
    @Body() payload: UpdateMemberRequest,
  ): Promise<MemberDetailApiResponse> {
    try {
      const updatedMember = await this.memberService.updateMember(
        session.user.id,
        memberId,
        payload,
      );
      await this.activityService.logActivity(
        session.user.id,
        'MEMBER_UPDATED',
        `Member updated: ${updatedMember.fullName}`,
        {
          memberName: updatedMember.fullName,
          seatId: updatedMember.seatId,
          memberId: updatedMember.id,
        },
      );

      return new MemberDetailApiResponse(new MemberData(updatedMember), 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('UPDATE_OWNER_MEMBER_FAILED');
    }
  }

  @Patch('/members/:memberId/mark-paid')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(MemberDetailApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async markMemberPaid(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('memberId') memberId: string,
    @Body() payload: MarkBookingPaidRequest,
  ): Promise<MemberDetailApiResponse> {
    try {
      const member = await this.memberService.markMemberPaid(
        session.user.id,
        memberId,
        payload.paymentMethod,
      );

      await this.activityService.logActivity(
        session.user.id,
        'PAYMENT_RECEIVED',
        `Payment received from ${member.fullName}`,
        {
          memberName: member.fullName,
          memberId: member.id,
          amount: member.planAmount,
          seatId: member.seatId,
        },
      );

      return new MemberDetailApiResponse(new MemberData(member), 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('MARK_MEMBER_PAID_FAILED');
    }
  }

  @Delete('/members/:memberId')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(MemberActionApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async deleteMember(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('memberId') memberId: string,
  ): Promise<MemberActionApiResponse> {
    try {
      const member = await this.memberService.getMemberById(session.user.id, memberId);
      const result = await this.memberService.deleteMember(session.user.id, memberId);

      await this.activityService.logActivity(
        session.user.id,
        'MEMBER_REMOVED',
        `Member removed: ${member.fullName}`,
        {
          memberName: member.fullName,
          memberId: member.id,
        },
      );

      return new MemberActionApiResponse(result.msg, 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('DELETE_OWNER_MEMBER_FAILED');
    }
  }

  @Post('/members/invite-link')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(MemberInviteLinkApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async generateMemberInviteLink(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: GenerateMemberInviteLinkRequest,
  ): Promise<MemberInviteLinkApiResponse> {
    try {
      const inviteLink = await this.memberService.generateMemberInviteLink(
        session.user.id,
        payload.siteLibraryId,
      );
      return new MemberInviteLinkApiResponse(
        'MEMBER_INVITE_LINK_GENERATED',
        new MemberInviteLinkData(inviteLink),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GENERATE_MEMBER_INVITE_LINK_FAILED');
    }
  }
}
