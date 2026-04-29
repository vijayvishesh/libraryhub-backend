import { ActivityActionType } from '../../constants/activity.constants';
import { ActivityMetadata } from '../../models/activity.model';

export type ActivityRecord = {
  id: string;
  userId: string;
  actionType: ActivityActionType;
  description: string;
  metadata?: ActivityMetadata;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
};
