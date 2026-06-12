import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { WebViewModel } from '../models/webView.model';
import {
  CreateWebViewInput,
  ListWebViewsQuery,
  ListWebViewsResult,
  UpdateWebViewInput,
  WebViewRecord,
} from './types/webView.repository.types';

@Service()
export class WebViewRepository {
  public async createWebView(input: CreateWebViewInput): Promise<WebViewRecord> {
    const repo = this.getRepository();
    const now = new Date();

    const webView = repo.create({
      title: input.title,
      url: input.url,
      icon: input.icon,
      isShow: input.isShow,
      role: input.role,
      scope: input.scope,
      libraryId: input.libraryId,
      order: input.order,
      createdAt: now,
      updatedAt: now,
    });

    const saved = await repo.save(webView);
    return this.mapWebView(saved);
  }

  public async findById(id: string): Promise<WebViewRecord | null> {
    const objectId = this.tryParseObjectId(id);
    if (!objectId) return null;

    const webView = await this.getRepository().findOneById(objectId);
    if (!webView) return null;

    return this.mapWebView(webView);
  }

  public async listWebViews(query: ListWebViewsQuery): Promise<ListWebViewsResult> {
    const repo = this.getRepository();
    const filter: Record<string, unknown> = {};

    if (query.role !== undefined) {
      filter.role = { $in: [query.role, 'both'] };
    }

    if (query.scope !== undefined) {
      filter.scope = query.scope;
    }

    if (query.libraryId !== undefined) {
      filter.libraryId = query.libraryId;
    }

    if (query.isShow !== undefined) {
      filter.isShow = query.isShow;
    }

    const [webViews, total] = await Promise.all([
      repo.find({
        where: filter,
        order: { order: 'ASC', createdAt: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      repo.count({ where: filter }),
    ]);

    return {
      webViews: webViews.map(w => this.mapWebView(w)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  public async updateWebView(id: string, input: UpdateWebViewInput): Promise<WebViewRecord | null> {
    const objectId = this.tryParseObjectId(id);
    if (!objectId) return null;

    const repo = this.getRepository();
    const webView = await repo.findOneById(objectId);
    if (!webView) return null;

    if (input.title !== undefined) webView.title = input.title;
    if (input.url !== undefined) webView.url = input.url;
    if (input.icon !== undefined) webView.icon = input.icon;
    if (input.isShow !== undefined) webView.isShow = input.isShow;
    if (input.role !== undefined) webView.role = input.role;
    if (input.scope !== undefined) webView.scope = input.scope;
    if (input.libraryId !== undefined) webView.libraryId = input.libraryId;
    if (input.order !== undefined) webView.order = input.order;
    webView.updatedAt = input.updatedAt;

    const saved = await repo.save(webView);
    return this.mapWebView(saved);
  }

  public async deleteWebView(id: string): Promise<boolean> {
    const objectId = this.tryParseObjectId(id);
    if (!objectId) return false;

    const repo = this.getRepository();
    const webView = await repo.findOneById(objectId);
    if (!webView) return false;

    await repo.delete(objectId);
    return true;
  }

  public async toggleVisibility(id: string): Promise<WebViewRecord | null> {
    const objectId = this.tryParseObjectId(id);
    if (!objectId) return null;

    const repo = this.getRepository();
    const webView = await repo.findOneById(objectId);
    if (!webView) return null;

    webView.isShow = !webView.isShow;
    webView.updatedAt = new Date();

    const saved = await repo.save(webView);
    return this.mapWebView(saved);
  }

  // Used by student/owner to get their web views
  // Returns: global web views for role + library-scoped web views for their libraryId
  public async findVisibleWebViewsForUser(
    role: 'student' | 'owner',
    libraryId?: string | null,
  ): Promise<WebViewRecord[]> {
    const repo = this.getRepository();

    const orConditions: Record<string, unknown>[] = [
      // global web views for this role
      {
        scope: 'global',
        isShow: true,
        role: { $in: [role, 'both'] },
      },
    ];

    // if user has a library, also fetch library-scoped ones
    if (libraryId) {
      orConditions.push({
        scope: 'library',
        libraryId,
        isShow: true,
        role: { $in: [role, 'both'] },
      });
    }

    const webViews = await repo.find({
      where: { $or: orConditions } as any,
      order: { order: 'ASC' },
    });

    return webViews.map(w => this.mapWebView(w));
  }

  private mapWebView(webView: WebViewModel): WebViewRecord {
    return {
      id: webView.id.toHexString(),
      title: webView.title,
      url: webView.url,
      icon: webView.icon,
      isShow: webView.isShow,
      role: webView.role,
      scope: webView.scope,
      libraryId: webView.libraryId ?? null,
      order: webView.order ?? 0,
      createdAt: webView.createdAt,
      updatedAt: webView.updatedAt,
    };
  }

  private tryParseObjectId(value: string): ObjectId | null {
    if (!ObjectId.isValid(value)) return null;
    return new ObjectId(value);
  }

  private getRepository(): MongoRepository<WebViewModel> {
    return getDataSource().getMongoRepository(WebViewModel);
  }

  public async getWebViewConfig(): Promise<boolean> {
  // Find any active global config record
  const repo = this.getRepository();
  const config = await repo.findOneBy({ scope: 'config' } as any);
  return config?.isWebViewApiNeedToCall ?? false;
}

public async getWebViewApiConfig(): Promise<boolean> {
  const repo = this.getRepository();
  const configs = await repo.find({
    where: { scope: 'config' } as any,
    take: 1,
  });
  return configs[0]?.isWebViewApiNeedToCall ?? false;
}

public async setWebViewApiConfig(isWebViewApiNeedToCall: boolean): Promise<void> {
  const repo = this.getRepository();
  const existing = await repo.find({
    where: { scope: 'config' } as any,
    take: 1,
  });

  if (existing.length > 0) {
    const doc = existing[0];
    await repo.updateOne(
      { _id: doc.id },
      { $set: { isWebViewApiNeedToCall, updatedAt: new Date() } },
    );
  } else {
    const now = new Date();
    await repo.save(repo.create({
      title: '__config__',
      url: '',
      icon: '',
      isShow: false,
      role: 'both',
      scope: 'config' as any,
      libraryId: null,
      order: 0,
      isWebViewApiNeedToCall,
      createdAt: now,
      updatedAt: now,
    }));
  }
}
}