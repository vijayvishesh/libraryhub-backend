import { Service } from 'typedi';
import { AppVersionRepository } from '../repositories/appVersion.repository';
import {
  AppUpdateStatus,
  AppVersionRecord,
  UpsertAppVersionInput,
} from '../repositories/types/appVersion.repository.types';
import { HttpError } from 'routing-controllers';
import { InternalServerError } from 'routing-controllers';
import { AppOs, AppRole } from '../models/appVersion.model';

// Simple semver compare: returns true if a < b
function isVersionLessThan(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return true;
    if (na > nb) return false;
  }
  return false;
}

@Service()
export class AppVersionService {
  constructor(private readonly appVersionRepository: AppVersionRepository) {}

  // ─── Admin: set/update version config ────────────────────────────────────

  public async upsertAppVersion(input: UpsertAppVersionInput): Promise<AppVersionRecord> {
    try {
      return await this.appVersionRepository.upsertVersion(input);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error('[AppVersionService] upsertAppVersion failed', { error });
      throw new InternalServerError('UPSERT_APP_VERSION_FAILED');
    }
  }

  public async getAllVersions(): Promise<AppVersionRecord[]> {
    return this.appVersionRepository.findAll();
  }

  // ─── Check if device needs update ────────────────────────────────────────

  public async checkUpdateStatus(
    userId: string,
    role: AppRole,
    platform: AppOs,
    currentVersion: string,
    deviceId: string,
  ): Promise<AppUpdateStatus> {
    const config = await this.appVersionRepository.findByPlatformAndRole(platform, role);

    // No config yet — no update required
    if (!config) {
      return {
        requiresUpdate: false,
        forceUpdate:    false,
        latestVersion:  currentVersion,
        currentVersion,
        message:        '',
      };
    }

    const belowMin     = isVersionLessThan(currentVersion, config.minVersion);
    const requiresUpdate = config.forceUpdate || belowMin;

    // Upsert device record so we track this device
    await this.appVersionRepository.upsertDeviceVersion({
      userId,
      role,
      platform,
      deviceId,
      currentVersion,
      isUpdated: !requiresUpdate,
    });

    return {
      requiresUpdate,
      forceUpdate:    config.forceUpdate || belowMin,
      latestVersion:  config.latestVersion,
      currentVersion,
      message:        requiresUpdate ? config.updateMessage : '',
    };
  }

  // ─── Device reports it has updated ───────────────────────────────────────

  public async markDeviceUpdated(
    userId: string,
    role: AppRole,
    platform: AppOs,
    deviceId: string,
    currentVersion: string,
  ): Promise<void> {
    try {
      await this.appVersionRepository.upsertDeviceVersion({
        userId,
        role,
        platform,
        deviceId,
        currentVersion,
        isUpdated: true,
      });
    } catch (error) {
      console.error('[AppVersionService] markDeviceUpdated failed', { error });
      throw new InternalServerError('MARK_DEVICE_UPDATED_FAILED');
    }
  }
}