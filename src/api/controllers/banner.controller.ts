import {
    Authorized,
  Body,
  Delete,
  Get,
  HttpCode,
  HttpError,
  InternalServerError,
  JsonController,
  OnUndefined,
  Param,
  Patch,
  Post,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { BannerService } from '../services/banner.service';
import { CreateBannerRequest, UpdateBannerRequest } from './requests/banner.request';
import {
  BannerApiResponse,
  BannerData,
  BannerListApiResponse,
  BannerListPayloadData,
} from './responses/banner.response';
import { ErrorResponseModel } from './responses/common.reponse';

@Service()
@JsonController('/v1/admin/banners')
export class AdminBannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Post('/')
  @Authorized('SUPER_ADMIN')
  @HttpCode(201)
  @OpenAPI({ summary: 'Create a sponsored banner (super admin only)' })
  @ResponseSchema(BannerApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async createBanner(
    @Body() payload: CreateBannerRequest,
  ): Promise<BannerApiResponse> {
    try {
      const record = await this.bannerService.createBanner(payload);
      return new BannerApiResponse(new BannerData(record), 201);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('CREATE_BANNER_FAILED');
    }
  }

  @Get('/')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'List all banners (super admin only)' })
  @ResponseSchema(BannerListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async listAllBanners(): Promise<BannerListApiResponse> {
    try {
      const records = await this.bannerService.listAllBanners();
      return new BannerListApiResponse(
        new BannerListPayloadData(records.map(r => new BannerData(r)), records.length),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('LIST_BANNERS_FAILED');
    }
  }

  @Patch('/:id')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Update a sponsored banner (super admin only)' })
  @ResponseSchema(BannerApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async updateBanner(
    @Param('id') id: string,
    @Body() payload: UpdateBannerRequest,
  ): Promise<BannerApiResponse> {
    try {
      const record = await this.bannerService.updateBanner(id, payload);
      return new BannerApiResponse(new BannerData(record), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('UPDATE_BANNER_FAILED');
    }
  }

  @Delete('/:id')
  @Authorized('SUPER_ADMIN')
  @OnUndefined(204)
  @OpenAPI({ summary: 'Delete a sponsored banner (super admin only)' })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async deleteBanner(
    @Param('id') id: string,
  ): Promise<void> {
    try {
      await this.bannerService.deleteBanner(id);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('DELETE_BANNER_FAILED');
    }
  }
}