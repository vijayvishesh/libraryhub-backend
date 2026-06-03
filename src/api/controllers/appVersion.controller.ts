import {
  Authorized,
  Body,
  CurrentUser,
  Get,
  HttpError,
  InternalServerError,
  JsonController,
  Patch,
  Post,
} from 'routing-controllers';
import { OpenAPI } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { AppVersionService } from '../services/appVersion.service';
import { MarkDeviceUpdatedRequest, UpsertAppVersionRequest } from './requests/appVersion.request';
import {
  AppVersionApiResponse,
  AppVersionData,
  AppVersionListApiResponse,
  MarkUpdatedApiResponse,
} from './responses/appVersion.response';
import { CurrentSessionData } from './responses/auth.response';
import { AppOs, AppRole } from '../models/appVersion.model';

@Service()
@JsonController('/v1/app-version')
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  // ─── SUPER_ADMIN: upsert version config ───────────────────────────────────

  /**
   * POST /v1/app-version
   * Called by super admin to set/update version config per platform + role.
   * Body: { platform, role, latestVersion, minVersion, forceUpdate, updateMessage }
   */
  @Post('/')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Set or update app version config', security: [{ bearerAuth: [] }] })
  public async upsertAppVersion(
    @Body() payload: UpsertAppVersionRequest,
  ): Promise<AppVersionApiResponse> {
    try {
      const record = await this.appVersionService.upsertAppVersion({
        platform:      payload.platform,
        role:          payload.role,
        latestVersion: payload.latestVersion,
        minVersion:    payload.minVersion,
        forceUpdate:   payload.forceUpdate,
        updateMessage: payload.updateMessage,
      });
      return new AppVersionApiResponse(new AppVersionData(record), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('UPSERT_APP_VERSION_FAILED');
    }
  }

  // ─── SUPER_ADMIN: list all version configs ────────────────────────────────

  /**
   * GET /v1/app-version
   * Returns all platform+role version configs.
   */
  @Get('/')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'List all app version configs', security: [{ bearerAuth: [] }] })
  public async getAllVersions(): Promise<AppVersionListApiResponse> {
    try {
      const records = await this.appVersionService.getAllVersions();
      return new AppVersionListApiResponse(records.map(r => new AppVersionData(r)), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_APP_VERSIONS_FAILED');
    }
  }

  // ─── STUDENT + OWNER: report device has updated ───────────────────────────

  /**
   * PATCH /v1/app-version/device
   * Called by device after updating the app.
   * Works for both STUDENT and OWNER roles.
   * Body: { platform, role, deviceId, currentVersion }
   */
  @Patch('/device')
  @Authorized()
  @OpenAPI({
    summary: 'Report that this device has updated the app',
    security: [{ bearerAuth: [] }],
  })
  public async markDeviceUpdated(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: MarkDeviceUpdatedRequest,
  ): Promise<MarkUpdatedApiResponse> {
    try {
      await this.appVersionService.markDeviceUpdated(
        session.user.id,
        payload.role as AppRole,
        payload.platform as AppOs,
        payload.deviceId,
        payload.currentVersion,
      );
      return new MarkUpdatedApiResponse(200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('MARK_DEVICE_UPDATED_FAILED');
    }
  }
}