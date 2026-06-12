import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { LibraryRepository } from '../repositories/library.repository';
import { WebViewRepository } from '../repositories/webView.repository';
import { WebViewRecord } from '../repositories/types/webView.repository.types';
import {
  CreateWebViewPayload,
  ListWebViewsServiceQuery,
  ListWebViewsServiceResult,
  UpdateWebViewPayload,
  WebViewResult,
} from './types/webView.service.types';

export type { WebViewResult, ListWebViewsServiceResult };

@Service()
export class WebViewService {
  constructor(
    private readonly webViewRepository: WebViewRepository,
    private readonly libraryRepository: LibraryRepository,
  ) {}

  // ─── Super Admin: Create ─────────────────────────────────────────────────

  public async createWebView(payload: CreateWebViewPayload): Promise<WebViewResult> {
    try {
      if (payload.scope === 'library') {
        if (!payload.libraryId) {
          throw new HttpError(400, 'LIBRARY_ID_REQUIRED_FOR_LIBRARY_SCOPE');
        }
        const library = await this.libraryRepository.findLibraryById(payload.libraryId);
        if (!library) {
          throw new HttpError(404, 'LIBRARY_NOT_FOUND');
        }
      }

      const webView = await this.webViewRepository.createWebView({
        title: payload.title.trim(),
        url: payload.url.trim(),
        icon: payload.icon.trim(),
        isShow: payload.isShow,
        role: payload.role,
        scope: payload.scope,
        libraryId: payload.scope === 'global' ? null : (payload.libraryId ?? null),
        order: payload.order ?? 0,
      });

      return this.mapResult(webView);
    } catch (error) {
      this.rethrow(error, 'CREATE_WEB_VIEW_FAILED');
    }
  }

  // ─── Super Admin: Get single by id ──────────────────────────────────────

  public async getWebViewById(id: string): Promise<WebViewResult> {
    try {
      const webView = await this.webViewRepository.findById(id);
      if (!webView) {
        throw new NotFoundError('WEB_VIEW_NOT_FOUND');
      }
      return this.mapResult(webView);
    } catch (error) {
      this.rethrow(error, 'GET_WEB_VIEW_FAILED');
    }
  }

  // ─── Super Admin: List all ───────────────────────────────────────────────

  public async listWebViews(query: ListWebViewsServiceQuery): Promise<ListWebViewsServiceResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit ?? 50;

      const result = await this.webViewRepository.listWebViews({
        role: query.role,
        scope: query.scope,
        libraryId: query.libraryId,
        isShow: query.isShow,
        page,
        limit,
      });

      return {
        webViews: result.webViews.map(w => this.mapResult(w)),
        total: result.total,
        page: result.page,
        limit: result.limit,
      };
    } catch (error) {
      this.rethrow(error, 'LIST_WEB_VIEWS_FAILED');
    }
  }

  // ─── Super Admin: Update ─────────────────────────────────────────────────

  public async updateWebView(id: string, payload: UpdateWebViewPayload): Promise<WebViewResult> {
    try {
      const existing = await this.webViewRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('WEB_VIEW_NOT_FOUND');
      }

      const newScope = payload.scope ?? existing.scope;
      const newLibraryId = payload.libraryId ?? existing.libraryId;

      if (newScope === 'library' && !newLibraryId) {
        throw new HttpError(400, 'LIBRARY_ID_REQUIRED_FOR_LIBRARY_SCOPE');
      }

      if (newScope === 'library' && newLibraryId) {
        const library = await this.libraryRepository.findLibraryById(newLibraryId);
        if (!library) {
          throw new HttpError(404, 'LIBRARY_NOT_FOUND');
        }
      }

      const updated = await this.webViewRepository.updateWebView(id, {
        title: payload.title?.trim(),
        url: payload.url?.trim(),
        icon: payload.icon?.trim(),
        isShow: payload.isShow,
        role: payload.role,
        scope: payload.scope,
        libraryId: newScope === 'global' ? null : newLibraryId,
        order: payload.order,
        updatedAt: new Date(),
      });

      if (!updated) {
        throw new NotFoundError('WEB_VIEW_NOT_FOUND');
      }

      return this.mapResult(updated);
    } catch (error) {
      this.rethrow(error, 'UPDATE_WEB_VIEW_FAILED');
    }
  }

  // ─── Super Admin: Delete ─────────────────────────────────────────────────

  public async deleteWebView(id: string): Promise<void> {
    try {
      const deleted = await this.webViewRepository.deleteWebView(id);
      if (!deleted) {
        throw new NotFoundError('WEB_VIEW_NOT_FOUND');
      }
    } catch (error) {
      this.rethrow(error, 'DELETE_WEB_VIEW_FAILED');
    }
  }

  // ─── Super Admin: Toggle isShow ──────────────────────────────────────────

  public async toggleWebView(id: string): Promise<WebViewResult> {
    try {
      const toggled = await this.webViewRepository.toggleVisibility(id);
      if (!toggled) {
        throw new NotFoundError('WEB_VIEW_NOT_FOUND');
      }
      return this.mapResult(toggled);
    } catch (error) {
      this.rethrow(error, 'TOGGLE_WEB_VIEW_FAILED');
    }
  }

  // ─── Student: Get web views ───────────────────────────────────────────────

  public async getWebViewsForStudent(libraryId?: string | null): Promise<WebViewResult[]> {
    try {
      const webViews = await this.webViewRepository.findVisibleWebViewsForUser(
        'student',
        libraryId,
      );
      return webViews.map(w => this.mapResult(w));
    } catch (error) {
      this.rethrow(error, 'GET_WEB_VIEWS_FAILED');
    }
  }

  // ─── Owner: Get web views ─────────────────────────────────────────────────

  public async getWebViewsForOwner(libraryId?: string | null): Promise<WebViewResult[]> {
    try {
      const webViews = await this.webViewRepository.findVisibleWebViewsForUser(
        'owner',
        libraryId,
      );
      return webViews.map(w => this.mapResult(w));
    } catch (error) {
      this.rethrow(error, 'GET_WEB_VIEWS_FAILED');
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private mapResult(webView: WebViewRecord): WebViewResult {
    return {
      id: webView.id,
      title: webView.title,
      url: webView.url,
      icon: webView.icon,
      isShow: webView.isShow,
      role: webView.role,
      scope: webView.scope,
      libraryId: webView.libraryId,
      order: webView.order,
      createdAt: webView.createdAt,
      updatedAt: webView.updatedAt,
    };
  }

  private rethrow(error: unknown, defaultMessage: string): never {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError(defaultMessage);
  }

  public async getWebViewApiConfig(): Promise<boolean> {
  try {
    return await this.webViewRepository.getWebViewApiConfig();
  } catch (error) {
    this.rethrow(error, 'GET_WEBVIEW_CONFIG_FAILED');
  }
}

public async setWebViewApiConfig(isWebViewApiNeedToCall: boolean): Promise<void> {
  try {
    await this.webViewRepository.setWebViewApiConfig(isWebViewApiNeedToCall);
  } catch (error) {
    this.rethrow(error, 'SET_WEBVIEW_CONFIG_FAILED');
  }
}
}