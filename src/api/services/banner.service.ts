import { NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { BannerRepository } from '../repositories/banner.repository';
import { BannerRecord } from '../repositories/types/banner.repository.types';
import { CreateBannerRequest, UpdateBannerRequest } from '../controllers/requests/banner.request';
import { BannerDurationUnit } from '../models/banner.model';

@Service()
export class BannerService {
  constructor(private readonly bannerRepository: BannerRepository) {}

  public async createBanner(input: CreateBannerRequest): Promise<BannerRecord> {
    const endDate = this.calculateEndDate(
      input.startDate,
      input.durationValue,
      input.durationUnit,
    );

    return this.bannerRepository.create({
      title: input.title,
      details: input.details,
      imageUrl: input.imageUrl,
      redirectUrl: input.redirectUrl || null,
      sponsorName: input.sponsorName,
      startDate: input.startDate,
      endDate,
      durationValue: input.durationValue,
      durationUnit: input.durationUnit,
      priority: input.priority || 1,
      isActive: input.isActive ?? true,
    });
  }

  public async listAllBanners(): Promise<BannerRecord[]> {
    return this.bannerRepository.findAll();
  }

  public async listActiveBanners(): Promise<BannerRecord[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.bannerRepository.findActiveBanners(today);
  }

  public async updateBanner(
    id: string,
    input: UpdateBannerRequest,
  ): Promise<BannerRecord> {
    const existing = await this.bannerRepository.findById(id);
    if (!existing || existing.deletedAt) throw new NotFoundError('BANNER_NOT_FOUND');

    // Recalculate endDate if duration or startDate changed
    const startDate = input.startDate || existing.startDate;
    const durationValue = input.durationValue || existing.durationValue;
    const durationUnit = input.durationUnit || existing.durationUnit;
    const endDate = this.calculateEndDate(startDate, durationValue, durationUnit);

    const updated = await this.bannerRepository.update(id, {
      ...input,
      endDate,
    });

    if (!updated) throw new NotFoundError('BANNER_NOT_FOUND');
    return updated;
  }

  public async deleteBanner(id: string): Promise<void> {
    const existing = await this.bannerRepository.findById(id);
    if (!existing || existing.deletedAt) throw new NotFoundError('BANNER_NOT_FOUND');
    await this.bannerRepository.softDelete(id);
  }

  private calculateEndDate(
    startDate: string,
    durationValue: number,
    durationUnit: BannerDurationUnit,
  ): string {
    const date = new Date(startDate);

    if (durationUnit === 'days') {
      date.setDate(date.getDate() + durationValue);
    } else if (durationUnit === 'months') {
      date.setMonth(date.getMonth() + durationValue);
    } else if (durationUnit === 'years') {
      date.setFullYear(date.getFullYear() + durationValue);
    }

    return date.toISOString().split('T')[0];
  }
}