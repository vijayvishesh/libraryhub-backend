export type CreateWebViewPayload = {
  title: string;
  url: string;
  icon: string;
  isShow: boolean;
  role: 'student' | 'owner' | 'both';
  scope: 'global' | 'library';
  libraryId?: string | null;
  order?: number;
};

export type UpdateWebViewPayload = Partial<CreateWebViewPayload>;

export type WebViewResult = {
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

export type ListWebViewsServiceQuery = {
  role?: 'student' | 'owner' | 'both';
  scope?: 'global' | 'library';
  libraryId?: string;
  isShow?: boolean;
  page?: number;
  limit?: number;
};

export type ListWebViewsServiceResult = {
  webViews: WebViewResult[];
  total: number;
  page: number;
  limit: number;
};