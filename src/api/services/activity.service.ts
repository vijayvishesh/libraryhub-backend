import { Service } from 'typedi';
import { getDataSource } from '../../database/config/ormconfig.default';
import { ActivityModel, ActivityMetadata } from '../models/activity.model';
import { ActivityActionType } from '../constants/activity.constants';

@Service()
export class ActivityService {
  private getActivityRepository() {
    return getDataSource().getMongoRepository(ActivityModel);
  }

  /**
   * Logs a user activity to the database.
   * @param userId - The ID of the user performing the action.
   * @param actionType - The type of action performed.
   * @param description - A human-readable description of the activity.
   * @param metadata - Optional additional data related to the activity.
   */
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
    } catch (error) {
      // Log the error but don't throw to avoid disrupting the main flow
      console.error('Failed to log activity:', error);
      // In a production app, you might want to use a proper logger here
    }
  }
}