import {
  Authorized,
  Body,
  CurrentUser,
  Get,
  HttpError,
  InternalServerError,
  JsonController,
  Param,
  Patch,
  Post,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { NotificationService } from '../services/notification.service';
import { RegisterFcmTokenRequest } from './requests/fcmToken.request';
import { CurrentSessionData } from './responses/auth.response';
import {
  NotificationApiResponse,
  NotificationData,
  NotificationListApiResponse,
  NotificationListPayloadData,
  UnreadCountApiResponse,
  UnreadCountData,
} from './responses/notification.response';
import { ErrorResponseModel } from './responses/common.reponse';

@Service()
@JsonController('/v1/students/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('/fcm-token')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Register FCM device token for push notifications', security: [{ bearerAuth: [] }] })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async registerFcmToken(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: RegisterFcmTokenRequest,
  ): Promise<{ responseCode: number; message: string }> {
    try {
      await this.notificationService.registerFcmToken(session.user.id, payload);
      return { responseCode: 200, message: 'FCM token registered successfully' };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('REGISTER_FCM_TOKEN_FAILED');
    }
  }

  @Get('/')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'List all notifications for student', security: [{ bearerAuth: [] }] })
  @ResponseSchema(NotificationListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async listNotifications(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<NotificationListApiResponse> {
    try {
      const result = await this.notificationService.listNotifications(session.user.id);
      return new NotificationListApiResponse(
        new NotificationListPayloadData(
          result.notifications.map(n => new NotificationData(n)),
          result.notifications.length,
          result.unreadCount,
        ),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('LIST_NOTIFICATIONS_FAILED');
    }
  }

  @Get('/unread-count')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Get unread notification count', security: [{ bearerAuth: [] }] })
  @ResponseSchema(UnreadCountApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getUnreadCount(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<UnreadCountApiResponse> {
    try {
      const count = await this.notificationService.getUnreadCount(session.user.id);
      return new UnreadCountApiResponse(new UnreadCountData(count), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_UNREAD_COUNT_FAILED');
    }
  }

  @Patch('/:id/read')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Mark a notification as read', security: [{ bearerAuth: [] }] })
  @ResponseSchema(NotificationApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async markAsRead(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<NotificationApiResponse> {
    try {
      const record = await this.notificationService.markAsRead(id, session.user.id);
      return new NotificationApiResponse(new NotificationData(record), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('MARK_AS_READ_FAILED');
    }
  }

  @Patch('/read-all')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Mark all notifications as read', security: [{ bearerAuth: [] }] })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async markAllAsRead(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<{ responseCode: number; message: string }> {
    try {
      await this.notificationService.markAllAsRead(session.user.id);
      return { responseCode: 200, message: 'All notifications marked as read' };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('MARK_ALL_AS_READ_FAILED');
    }
  }
}