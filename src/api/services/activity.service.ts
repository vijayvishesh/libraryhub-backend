import { Service } from 'typedi';
import { getDataSource } from '../../database/config/ormconfig.default';
import { ActivityActionType } from '../constants/activity.constants';
import { ActivityMetadata, ActivityModel } from '../models/activity.model';
import { ActivityRecord } from './types/activity.service.types';

export type { ActivityRecord };

@Service()
export class ActivityService {
  private getActivityRepository() {
    return getDataSource().getMongoRepository(ActivityModel);
  }

  public async logActivity(
    userId: string,
    actionType: ActivityActionType,
    description: string,
    metadata?: ActivityMetadata,
  ): Promise<void> {
    try {
      const activityRepository = this.getActivityRepository();
      const now = new Date();

      const activity = activityRepository.create({
        userId,
        actionType,
        description,
        metadata,
        timestamp: now,
        createdAt: now,
        updatedAt: now,
      });

      await activityRepository.save(activity);
    } catch {
      // non-critical, don't disrupt the main flow
    }
  }

  public async listRecentActivities(userId: string, limit = 3): Promise<ActivityRecord[]> {
    const activityRepository = this.getActivityRepository();
    const activities = await activityRepository.find({
      where: { userId: userId.trim() },
      order: { timestamp: 'DESC' },
      take: Math.max(1, Math.min(limit, 20)),
    });

    return activities.map(item => ({
      id: item.id.toHexString(),
      userId: item.userId,
      actionType: item.actionType,
      description: item.description,
      metadata: item.metadata,
      timestamp: item.timestamp,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }
}
