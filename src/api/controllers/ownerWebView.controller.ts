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
import { LibraryRepository } from '../repositories/library.repository';
import { WebViewService } from '../services/webView.service';
import { CurrentSessionData } from './responses/auth.response';
import { ErrorResponseModel } from './responses/common.reponse';
import { WebViewUserItemData, WebViewUserListApiResponse } from './responses/webView.response';

@Service()
@JsonController('/v1/web-views')
export class OwnerWebViewController {
  constructor(
    private readonly webViewService: WebViewService,
    private readonly libraryRepository: LibraryRepository,
  ) {}

  @Get('/owner')
  @Authorized('OWNER')
  @OpenAPI({ summary: 'Get web views for owner', security: [{ bearerAuth: [] }] })
  @ResponseSchema(WebViewUserListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getOwnerWebViews(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<WebViewUserListApiResponse> {
    try {
      // Resolve the owner's library
      const library = await this.libraryRepository.findLibraryByOwnerId(session.user.id);
      const libraryId = library?.id ?? null;

      const webViews = await this.webViewService.getWebViewsForOwner(libraryId);

      return new WebViewUserListApiResponse(
        webViews.map(w => new WebViewUserItemData({
          id: w.id,
          title: w.title,
          url: w.url,
          icon: w.icon,
          order: w.order,
        })),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_WEB_VIEWS_FAILED');
    }
  }
}