import {
  Authorized,
  CurrentUser,
  Get,
  HttpError,
  InternalServerError,
  JsonController,
  Param,
  Patch,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { CurrentSessionData } from './responses/auth.response';
import { ErrorResponseModel } from './responses/common.reponse';
import { OwnerNotificationService } from '../services/owner.notification.service';
import { OwnerNotificationListApiResponse, OwnerNotificationListPayload, OwnerNotificationData, OwnerUnreadCountApiResponse, OwnerUnreadCountData, OwnerNotificationApiResponse } from './responses/owner.notification.response';

@Service()
@JsonController('/v1/owner/notifications')
export class OwnerNotificationController {
  constructor(
    private readonly ownerNotificationService: OwnerNotificationService,
  ) {}

  // GET /v1/owner/notifications
  // Returns all notifications + unread count badge
  @Get('/')
  @Authorized('OWNER')
  @OpenAPI({
    summary: 'List all notifications for owner with unread badge count',
    security: [{ bearerAuth: [] }],
  })
  @ResponseSchema(OwnerNotificationListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async listNotifications(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<OwnerNotificationListApiResponse> {
    try {
      const result = await this.ownerNotificationService.listNotifications(session.user.id);
      return new OwnerNotificationListApiResponse(
        new OwnerNotificationListPayload(
          result.notifications.map(n => new OwnerNotificationData(n)),
          result.total,
          result.unreadCount,
        ),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('LIST_OWNER_NOTIFICATIONS_FAILED');
    }
  }

  // GET /v1/owner/notifications/unread-count
  // Badge count only — lightweight for polling
  @Get('/unread-count')
  @Authorized('OWNER')
  @OpenAPI({
    summary: 'Get unread notification badge count for owner',
    security: [{ bearerAuth: [] }],
  })
  @ResponseSchema(OwnerUnreadCountApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getUnreadCount(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<OwnerUnreadCountApiResponse> {
    try {
      const count = await this.ownerNotificationService.getUnreadCount(session.user.id);
      return new OwnerUnreadCountApiResponse(new OwnerUnreadCountData(count), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_OWNER_UNREAD_COUNT_FAILED');
    }
  }

  // PATCH /v1/owner/notifications/:id/read
  // Mark single notification as read
  @Patch('/:id/read')
  @Authorized('OWNER')
  @OpenAPI({
    summary: 'Mark a single owner notification as read',
    security: [{ bearerAuth: [] }],
  })
  @ResponseSchema(OwnerNotificationApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async markAsRead(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<OwnerNotificationApiResponse> {
    try {
      const record = await this.ownerNotificationService.markAsRead(id, session.user.id);
      return new OwnerNotificationApiResponse(new OwnerNotificationData(record), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('MARK_OWNER_NOTIFICATION_READ_FAILED');
    }
  }

  // PATCH /v1/owner/notifications/read-all
  // Mark all notifications as read
  @Patch('/read-all')
  @Authorized('OWNER')
  @OpenAPI({
    summary: 'Mark all owner notifications as read',
    security: [{ bearerAuth: [] }],
  })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async markAllAsRead(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<{ responseCode: number; message: string }> {
    try {
      await this.ownerNotificationService.markAllAsRead(session.user.id);
      return { responseCode: 200, message: 'All notifications marked as read' };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('MARK_ALL_OWNER_NOTIFICATIONS_READ_FAILED');
    }
  }
}