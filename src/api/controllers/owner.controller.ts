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
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { ActivityService } from '../services/activity.service';
import { BookingService } from '../services/booking.service';
import { MemberService } from '../services/member.service';
import { OwnerService } from '../services/owner.service';
import { MarkBookingPaidRequest, OwnerFeeCollectionQueryRequest } from './requests/booking.request';
import {
  AddMemberRequest,
  ListMembersQueryRequest,
  UpdateMemberRequest,
} from './requests/member.request';
import { CurrentSessionData } from './responses/auth.response';
import {
  BookingMarkPaidApiResponse,
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
  MemberListApiResponse,
  MemberListPayloadData,
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
    private readonly bookingService: BookingService,
    private readonly memberService: MemberService,
    private readonly activityService: ActivityService,
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
      const result = await this.bookingService.getOwnerFeeCollection(session.user.id, query);

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

  @Patch('/fee-collection/:bookingId/mark-paid')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(BookingMarkPaidApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async markBookingPaid(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('bookingId') bookingId: string,
    @Body() payload: MarkBookingPaidRequest,
  ): Promise<BookingMarkPaidApiResponse> {
    try {
      const paidItem = await this.bookingService.markOwnerBookingPaid(
        session.user.id,
        bookingId,
        payload.paymentMethod,
      );

      await this.activityService.logActivity(
        session.user.id,
        'PAYMENT_RECEIVED',
        `Payment received for seat ${paidItem.seatId}`,
        {
          memberName: paidItem.studentName,
          seatId: paidItem.seatId,
          amount: paidItem.amount,
        },
      );

      return new BookingMarkPaidApiResponse(
        'BOOKING_MARKED_AS_PAID',
        new OwnerFeeCollectionItemData(paidItem),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('MARK_OWNER_BOOKING_PAID_FAILED');
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
}
