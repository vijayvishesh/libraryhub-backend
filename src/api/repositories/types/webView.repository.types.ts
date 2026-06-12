export type WebViewRecord = {
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
};

export type CreateWebViewInput = {
  title: string;
  url: string;
  icon: string;
  isShow: boolean;
  role: 'student' | 'owner' | 'both';
  scope: 'global' | 'library';
  libraryId: string | null;
  order: number;
};

export type UpdateWebViewInput = Partial<CreateWebViewInput> & {
  updatedAt: Date;
};

export type ListWebViewsQuery = {
  role?: 'student' | 'owner' | 'both';
  scope?: 'global' | 'library';
  libraryId?: string;
  isShow?: boolean;
  page: number;
  limit: number;
};

export type ListWebViewsResult = {
  webViews: WebViewRecord[];
  total: number;
  page: number;
  limit: number;
};

export type WebViewConfigRecord = {
  isWebViewApiNeedToCall: boolean;
};