import { SubscriptionPlanFeatures } from '../../models/subscriptionPlan.model';

export type CreateSubscriptionPlanInput = {
  name: string;
  description: string;
  price: number;
  durationDays: number;
  features: SubscriptionPlanFeatures;
  isActive: boolean;
  sortOrder: number;
};

export type SubscriptionPlanRecord = CreateSubscriptionPlanInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UpdateSubscriptionPlanInput = Partial<{
  name: string;
  description: string;
  price: number;
  durationDays: number;
  features: SubscriptionPlanFeatures;
  isActive: boolean;
  sortOrder: number;
  updatedAt: Date;
}>;