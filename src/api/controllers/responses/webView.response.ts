import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class WebViewData {
  @IsString()
  id!: string;

  @IsString()
  title!: string;

  @IsString()
  url!: string;

  @IsString()
  icon!: string;

  @IsBoolean()
  isShow!: boolean;

  @IsString()
  role!: 'student' | 'owner' | 'both';

  @IsString()
  scope!: 'global' | 'library';

  @IsOptional()
  @IsString()
  libraryId?: string | null;

  @IsNumber()
  order!: number;

  @IsString()
  createdAt!: string;

  @IsString()
  updatedAt!: string;

  constructor(params?: {
    id: string;
    title: string;
    url: string;
    icon: string;
    isShow: boolean;
    role: 'student' | 'owner' | 'both';
    scope: 'global' | 'library';
    libraryId: string | null;
    order: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    if (!params) return;

    this.id = params.id;
    this.title = params.title;
    this.url = params.url;
    this.icon = params.icon;
    this.isShow = params.isShow;
    this.role = params.role;
    this.scope = params.scope;
    this.libraryId = params.libraryId;
    this.order = params.order;
    this.createdAt = params.createdAt.toISOString();
    this.updatedAt = params.updatedAt.toISOString();
  }
}

// ─── Single web view response ─────────────────────────────────────────────────

export class WebViewApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => WebViewData)
  data!: WebViewData;

  constructor(data?: WebViewData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

// ─── List response (super admin) ──────────────────────────────────────────────

export class WebViewListPayloadData {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebViewData)
  webViews!: WebViewData[];

  @IsNumber()
  page!: number;

  @IsNumber()
  limit!: number;

  @IsNumber()
  total!: number;

  constructor(webViews?: WebViewData[], page?: number, limit?: number, total?: number) {
    if (!webViews || typeof page !== 'number' || typeof limit !== 'number' || typeof total !== 'number') return;
    this.webViews = webViews;
    this.page = page;
    this.limit = limit;
    this.total = total;
  }
}

export class WebViewListApiResponse {
  @IsNumber()
  responseCode!: number;

  @ValidateNested()
  @Type(() => WebViewListPayloadData)
  data!: WebViewListPayloadData;

  constructor(data?: WebViewListPayloadData, responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

// ─── User-facing list response (student / owner) ──────────────────────────────
// Simpler — only returns fields frontend needs to render the webview

export class WebViewUserItemData {
  @IsString()
  id!: string;

  @IsString()
  title!: string;

  @IsString()
  url!: string;

  @IsString()
  icon!: string;

  @IsNumber()
  order!: number;

  constructor(params?: {
    id: string;
    title: string;
    url: string;
    icon: string;
    order: number;
  }) {
    if (!params) return;
    this.id = params.id;
    this.title = params.title;
    this.url = params.url;
    this.icon = params.icon;
    this.order = params.order;
  }
}

export class WebViewUserListApiResponse {
  @IsNumber()
  responseCode!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebViewUserItemData)
  data!: WebViewUserItemData[];

  constructor(data?: WebViewUserItemData[], responseCode = 200) {
    if (!data || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.data = data;
  }
}

// ─── Delete / action response ─────────────────────────────────────────────────

export class WebViewActionApiResponse {
  @IsNumber()
  responseCode!: number;

  @IsString()
  message!: string;

  constructor(message?: string, responseCode = 200) {
    if (!message || typeof responseCode !== 'number') return;
    this.responseCode = responseCode;
    this.message = message;
  }
}