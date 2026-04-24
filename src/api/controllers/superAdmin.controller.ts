import {
  Authorized,
  Body,
  CurrentUser,
  Get,
//   HttpCode,
  HttpError,
  InternalServerError,
  JsonController,
  Post,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { SuperAdminService } from '../services/superAdmin.service';
import {
//   CreateSuperAdminRequest,
  SuperAdminLoginRequest,
} from './requests/superAdmin.request';
import { CurrentSessionData } from './responses/auth.response';
import {
  SuperAdminAuthApiResponse,
  SuperAdminAuthData,
  SuperAdminData,
  SuperAdminTokenData,
} from './responses/superAdmin.response';
import { ErrorResponseModel } from './responses/common.reponse';

@Service()
@JsonController('/v1/admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Post('/login')
  @OpenAPI({ summary: 'Super admin login' })
  @ResponseSchema(SuperAdminAuthApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async login(
    @Body() payload: SuperAdminLoginRequest,
  ): Promise<SuperAdminAuthApiResponse> {
    try {
      const result = await this.superAdminService.login(payload);
      return new SuperAdminAuthApiResponse(
        new SuperAdminAuthData(
          new SuperAdminTokenData(result.accessToken, result.refreshToken),
          new SuperAdminData(result.admin),
        ),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('SUPER_ADMIN_LOGIN_FAILED');
    }
  }

//   @Post('/register')
//   @HttpCode(201)
//   @OpenAPI({ summary: 'Create super admin account (first time setup)' })
//   @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
//   @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
//   public async createSuperAdmin(
//     @Body() payload: CreateSuperAdminRequest,
//   ): Promise<{ responseCode: number; message: string }> {
//     try {
//       await this.superAdminService.createSuperAdmin(payload);
//       return { responseCode: 201, message: 'Super admin created successfully' };
//     } catch (error) {
//       if (error instanceof HttpError) throw error;
//       throw new InternalServerError('CREATE_SUPER_ADMIN_FAILED');
//     }
//   }

  @Get('/me')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Get current super admin profile', security: [{ bearerAuth: [] }] })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getMe(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<{ responseCode: number; data: SuperAdminData }> {
    try {
      const admin = await this.superAdminService.getAdminById(session.user.id);
      return { responseCode: 200, data: new SuperAdminData(admin ?? undefined) };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_SUPER_ADMIN_FAILED');
    }
  }
}