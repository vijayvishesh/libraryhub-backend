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
export class StudentWebViewController {
  constructor(
    private readonly webViewService: WebViewService,
    private readonly libraryRepository: LibraryRepository,
  ) {}

  @Get('/student')
  @Authorized('STUDENT')
  @OpenAPI({ summary: 'Get web views for student', security: [{ bearerAuth: [] }] })
  @ResponseSchema(WebViewUserListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getStudentWebViews(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<WebViewUserListApiResponse> {
    try {
      // Resolve the student's library — find their active booking's libraryId
      // We pass null if they have no library; service handles both cases
      const libraryId = await this.resolveStudentLibraryId(session.user.id);

      const webViews = await this.webViewService.getWebViewsForStudent(libraryId);

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

  // Resolve the libraryId from the student's active booking
  // Returns null if no active booking found — student still gets global web views
  private async resolveStudentLibraryId(studentId: string): Promise<string | null> {
    try {
      const library = await this.libraryRepository.findLibraryByStudentId(studentId);
      return library?.id ?? null;
    } catch {
      return null;
    }
  }
}