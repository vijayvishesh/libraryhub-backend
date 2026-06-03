import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { DeviceAppVersionModel } from '../models/deviceAppVersion.model';
import {
  AppVersionRecord,
  DeviceAppVersionRecord,
  UpsertAppVersionInput,
  UpsertDeviceVersionInput,
} from './types/appVersion.repository.types';
import { AppOs, AppRole, AppVersionModel } from '../models/appVersion.model';

@Service()
export class AppVersionRepository {

  // ─── AppVersion (global config) ───────────────────────────────────────────

  public async findByPlatformAndRole(
    platform: AppOs,
    role: AppRole,
  ): Promise<AppVersionRecord | null> {
    const doc = await this.getVersionRepo().findOne({
      where: { platform, role } as any,
    });
    return doc ? this.mapVersion(doc) : null;
  }

  public async findAll(): Promise<AppVersionRecord[]> {
    const docs = await this.getVersionRepo().find();
    return docs.map(d => this.mapVersion(d));
  }

  public async upsertVersion(input: UpsertAppVersionInput): Promise<AppVersionRecord> {
    const repo = this.getVersionRepo();
    const existing = await repo.findOne({
      where: { platform: input.platform, role: input.role } as any,
    });
    const now = new Date();

    if (existing) {
      await repo.updateOne(
        { _id: existing.id },
        {
          $set: {
            latestVersion: input.latestVersion,
            minVersion:    input.minVersion,
            forceUpdate:   input.forceUpdate,
            updateMessage: input.updateMessage,
            updatedAt:     now,
          },
        },
      );
      const updated = await repo.findOne({ where: { _id: existing.id } as any });
      return this.mapVersion(updated!);
    }

    const doc = repo.create({ ...input, createdAt: now, updatedAt: now });
    const saved = await repo.save(doc);
    return this.mapVersion(saved);
  }

  // ─── DeviceAppVersion (per-device tracking) ───────────────────────────────

  public async findDeviceVersion(
    userId: string,
    platform: AppOs,
    role: AppRole,
  ): Promise<DeviceAppVersionRecord | null> {
    const doc = await this.getDeviceRepo().findOne({
      where: { userId, platform, role } as any,
    });
    return doc ? this.mapDevice(doc) : null;
  }

  public async upsertDeviceVersion(
    input: UpsertDeviceVersionInput,
  ): Promise<DeviceAppVersionRecord> {
    const repo = this.getDeviceRepo();
    const existing = await repo.findOne({
      where: { userId: input.userId, platform: input.platform, role: input.role } as any,
    });
    const now = new Date();

    if (existing) {
      await repo.updateOne(
        { _id: existing.id },
        {
          $set: {
            deviceId:       input.deviceId,
            currentVersion: input.currentVersion,
            isUpdated:      input.isUpdated,
            updatedAt:      now,
          },
        },
      );
      const updated = await repo.findOne({ where: { _id: existing.id } as any });
      return this.mapDevice(updated!);
    }

    const doc = repo.create({ ...input, createdAt: now, updatedAt: now });
    const saved = await repo.save(doc);
    return this.mapDevice(saved);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private mapVersion(doc: AppVersionModel): AppVersionRecord {
    return {
      id:            doc.id.toHexString(),
      platform:      doc.platform,
      role:          doc.role,
      latestVersion: doc.latestVersion,
      minVersion:    doc.minVersion,
      forceUpdate:   doc.forceUpdate,
      updateMessage: doc.updateMessage,
      createdAt:     doc.createdAt,
      updatedAt:     doc.updatedAt,
    };
  }

  private mapDevice(doc: DeviceAppVersionModel): DeviceAppVersionRecord {
    return {
      id:             doc.id.toHexString(),
      userId:         doc.userId,
      role:           doc.role,
      platform:       doc.platform,
      deviceId:       doc.deviceId,
      currentVersion: doc.currentVersion,
      isUpdated:      doc.isUpdated,
      createdAt:      doc.createdAt,
      updatedAt:      doc.updatedAt,
    };
  }

  private getVersionRepo(): MongoRepository<AppVersionModel> {
    return getDataSource().getMongoRepository(AppVersionModel);
  }

  private getDeviceRepo(): MongoRepository<DeviceAppVersionModel> {
    return getDataSource().getMongoRepository(DeviceAppVersionModel);
  }
}