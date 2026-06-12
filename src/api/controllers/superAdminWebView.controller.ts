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
import { WebViewService } from '../services/webView.service';
import {
  CreateWebViewRequest,
  ListWebViewsQueryRequest,
  UpdateWebViewRequest,
} from './requests/webView.request';
import { CurrentSessionData } from './responses/auth.response';
import { ErrorResponseModel } from './responses/common.reponse';
import {
  WebViewActionApiResponse,
  WebViewApiResponse,
  WebViewData,
  WebViewListApiResponse,
  WebViewListPayloadData,
} from './responses/webView.response';

@Service()
@JsonController('/v1/admin/web-views')
export class SuperAdminWebViewController {
  constructor(private readonly webViewService: WebViewService) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  @Post('/')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Create a new web view', security: [{ bearerAuth: [] }] })
  @ResponseSchema(WebViewApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async createWebView(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Body() payload: CreateWebViewRequest,
  ): Promise<WebViewApiResponse> {
    try {
      const result = await this.webViewService.createWebView(payload);
      return new WebViewApiResponse(new WebViewData(result), 201);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('CREATE_WEB_VIEW_FAILED');
    }
  }

  // ─── List all (with filters) ──────────────────────────────────────────────

  @Get('/')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'List all web views', security: [{ bearerAuth: [] }] })
  @ResponseSchema(WebViewListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async listWebViews(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @QueryParams() query: ListWebViewsQueryRequest,
  ): Promise<WebViewListApiResponse> {
    try {
      const result = await this.webViewService.listWebViews({
        role: query.role,
        scope: query.scope,
        libraryId: query.libraryId,
        isShow: query.isShow,
        page: query.page,
        limit: query.limit,
      });

      return new WebViewListApiResponse(
        new WebViewListPayloadData(
          result.webViews.map(w => new WebViewData(w)),
          result.page,
          result.limit,
          result.total,
        ),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('LIST_WEB_VIEWS_FAILED');
    }
  }

  // ─── Get single ───────────────────────────────────────────────────────────

  @Get('/:id')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Get web view by id', security: [{ bearerAuth: [] }] })
  @ResponseSchema(WebViewApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getWebView(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<WebViewApiResponse> {
    try {
      const result = await this.webViewService.getWebViewById(id);
      return new WebViewApiResponse(new WebViewData(result), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_WEB_VIEW_FAILED');
    }
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  @Patch('/:id')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Update a web view', security: [{ bearerAuth: [] }] })
  @ResponseSchema(WebViewApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async updateWebView(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Param('id') id: string,
    @Body() payload: UpdateWebViewRequest,
  ): Promise<WebViewApiResponse> {
    try {
      const result = await this.webViewService.updateWebView(id, payload);
      return new WebViewApiResponse(new WebViewData(result), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('UPDATE_WEB_VIEW_FAILED');
    }
  }

  // ─── Toggle isShow ────────────────────────────────────────────────────────

  @Patch('/:id/toggle')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Toggle web view visibility (isShow)', security: [{ bearerAuth: [] }] })
  @ResponseSchema(WebViewApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async toggleWebView(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<WebViewApiResponse> {
    try {
      const result = await this.webViewService.toggleWebView(id);
      return new WebViewApiResponse(new WebViewData(result), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('TOGGLE_WEB_VIEW_FAILED');
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  @Delete('/:id')
  @Authorized('SUPER_ADMIN')
  @OpenAPI({ summary: 'Delete a web view', security: [{ bearerAuth: [] }] })
  @ResponseSchema(WebViewActionApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async deleteWebView(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Param('id') id: string,
  ): Promise<WebViewActionApiResponse> {
    try {
      await this.webViewService.deleteWebView(id);
      return new WebViewActionApiResponse('Web view deleted successfully', 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('DELETE_WEB_VIEW_FAILED');
    }
  }
  @Patch('/config/web-view-api')
@Authorized('SUPER_ADMIN')
@OpenAPI({ summary: 'Toggle isWebViewApiNeedToCall globally', security: [{ bearerAuth: [] }] })
public async setWebViewApiConfig(
  @CurrentUser({ required: true }) _session: CurrentSessionData,
  @Body() payload: { isWebViewApiNeedToCall: boolean },
): Promise<{ responseCode: number; data: { isWebViewApiNeedToCall: boolean } }> {
  try {
    await this.webViewService.setWebViewApiConfig(payload.isWebViewApiNeedToCall);
    return { responseCode: 200, data: { isWebViewApiNeedToCall: payload.isWebViewApiNeedToCall } };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError('SET_WEBVIEW_CONFIG_FAILED');
  }
}
}