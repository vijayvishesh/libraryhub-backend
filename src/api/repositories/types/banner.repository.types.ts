import { BannerDurationUnit } from '../../models/banner.model';

export type BannerRecord = {
  id: string;
  title: string;
  details: string;
  imageUrl: string;
  redirectUrl: string | null;
  sponsorName: string;
  startDate: string;
  endDate: string;
  durationValue: number;
  durationUnit: BannerDurationUnit;
  priority: number;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateBannerInput = {
  title: string;
  details: string;
  imageUrl: string;
  redirectUrl: string | null;
  sponsorName: string;
  startDate: string;
  endDate: string;
  durationValue: number;
  durationUnit: BannerDurationUnit;
  priority: number;
  isActive: boolean;
};

export type UpdateBannerInput = {
  title?: string;
  details?: string;
  imageUrl?: string;
  redirectUrl?: string | null;
  sponsorName?: string;
  startDate?: string;
  endDate?: string;
  durationValue?: number;
  durationUnit?: BannerDurationUnit;
  priority?: number;
  isActive?: boolean;
};