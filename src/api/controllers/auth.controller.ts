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
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { ActivityService } from '../services/activity.service';
import { AuthService } from '../services/auth.service';
import {
  ChangePasswordRequest,
  LoginRequest,
  LogoutRequest,
  RefreshSessionRequest,
  RegisterRequest,
  SendOtpRequest,
  UpdateProfileRequest,
  VerifyOtpWithRoleRequest,
} from './requests/auth.request';
import {
  AuthApiResponse,
  AuthRegisterApiResponse,
  CurrentSessionApiResponse,
  CurrentSessionData,
  LogoutApiResponse,
  OtpSendApiResponse,
  SessionTokenApiResponse,
} from './responses/auth.response';
import { ErrorResponseModel } from './responses/common.reponse';

@Service()
@JsonController('/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly activityService: ActivityService,
  ) {}

  @Post('/register')
  @ResponseSchema(AuthRegisterApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async register(@Body() payload: RegisterRequest): Promise<AuthRegisterApiResponse> {
    try {
      const data = await this.authService.register(payload);
      return new AuthRegisterApiResponse(data, 201);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('REGISTER_FAILED');
    }
  }

  @Post('/otp/send')
  @ResponseSchema(OtpSendApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async sendOtp(@Body() payload: SendOtpRequest): Promise<OtpSendApiResponse> {
    try {
      const expiresIn = await this.authService.sendOtp(payload);
      return new OtpSendApiResponse(expiresIn, 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('SEND_OTP_FAILED');
    }
  }

  @Post('/otp/verify')
  @ResponseSchema(AuthApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async verifyOtp(@Body() payload: VerifyOtpWithRoleRequest): Promise<AuthApiResponse> {
    try {
      const data = await this.authService.verifyOtpAndLogin(payload);
      return new AuthApiResponse(data, 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('VERIFY_OTP_FAILED');
    }
  }

  @Post('/login')
  @ResponseSchema(AuthApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async login(@Body() payload: LoginRequest): Promise<AuthApiResponse> {
    try {
      const data = await this.authService.login(payload);

      // Log the activity
      await this.activityService.logActivity(
        data.user.id,
        'USER_LOGGED_IN',
        `User logged in: ${data.user.phone}`,
        { phone: data.user.phone, role: data.user.role },
      );

      return new AuthApiResponse(data, 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('LOGIN_FAILED');
    }
  }

  @Get('/me')
  @Authorized()
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(CurrentSessionApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async me(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<CurrentSessionApiResponse> {
    return new CurrentSessionApiResponse(session, 200);
  }

  @Patch('/me')
  @Authorized()
  @OpenAPI({ summary: 'Update current user profile', security: [{ bearerAuth: [] }] })
  @ResponseSchema(CurrentSessionApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async updateProfile(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: UpdateProfileRequest,
  ): Promise<CurrentSessionApiResponse> {
    try {
      const updated = await this.authService.updateProfile(session, payload);
      return new CurrentSessionApiResponse(updated, 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('UPDATE_PROFILE_FAILED');
    }
  }

  @Post('/refresh')
  @ResponseSchema(SessionTokenApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async refresh(@Body() payload: RefreshSessionRequest): Promise<SessionTokenApiResponse> {
    try {
      const data = await this.authService.refreshSession(payload);
      return new SessionTokenApiResponse(data, 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('REFRESH_SESSION_FAILED');
    }
  }

  @Post('/logout')
  @ResponseSchema(LogoutApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async logout(@Body() payload: LogoutRequest): Promise<LogoutApiResponse> {
    try {
      const data = await this.authService.logout(payload);
      return new LogoutApiResponse(data, 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('LOGOUT_FAILED');
    }
  }

  @Patch('/change-password')
@Authorized()
@OpenAPI({ summary: 'Change current user password', security: [{ bearerAuth: [] }] })
@ResponseSchema(ErrorResponseModel, { statusCode: 400 })
@ResponseSchema(ErrorResponseModel, { statusCode: 401 })
@ResponseSchema(ErrorResponseModel, { statusCode: 500 })
public async changePassword(
  @CurrentUser({ required: true }) session: CurrentSessionData,
  @Body() payload: ChangePasswordRequest,
): Promise<{ responseCode: number; message: string }> {
  try {
    await this.authService.changePassword(session, payload);
    return { responseCode: 200, message: 'Password changed successfully' };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError('CHANGE_PASSWORD_FAILED');
  }
}
}
