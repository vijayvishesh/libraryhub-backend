import { LibrarySubscriptionStatus } from "../../models/librarySubscription.model";
import { SubscriptionPlanFeatures } from "../../models/subscriptionPlan.model";


export type CreateLibrarySubscriptionInput = {
  libraryId: string;
  planId: string;
  planName: string;
  features: SubscriptionPlanFeatures;
  status: LibrarySubscriptionStatus;
  activatedBy: 'owner' | 'admin';
  startDate: string;
  endDate: string;
  amount: number;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
};

export type LibrarySubscriptionRecord = CreateLibrarySubscriptionInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateLibrarySubscriptionInput = Partial<{
  planId: string;
  planName: string;
  features: SubscriptionPlanFeatures;
  status: LibrarySubscriptionStatus;
  startDate: string;
  endDate: string;
  amount: number;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  updatedAt: Date;
}>;

export type ListLibrarySubscriptionsQuery = {
  libraryId?: string;
  status?: LibrarySubscriptionStatus;
  activatedBy?: 'owner' | 'admin';
  page: number;
  limit: number;
};

export type ListLibrarySubscriptionsResult = {
  subscriptions: LibrarySubscriptionRecord[];
  total: number;
};