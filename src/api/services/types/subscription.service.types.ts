import { SubscriptionPlanFeatures } from '../../models/subscriptionPlan.model';

export type SubscriptionPlanResult = {
  id: string;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  features: SubscriptionPlanFeatures;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type LibrarySubscriptionResult = {
  id: string;
  libraryId: string;
  planId: string;
  planName: string;
  features: SubscriptionPlanFeatures;
  status: string;
  activatedBy: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  amount: number;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LibrarySubscriptionStatusResult =
  | { noPlan: true;  libraryId: string; message: string; availablePlans: SubscriptionPlanResult[] }
  | { noPlan: false; subscription: LibrarySubscriptionResult };