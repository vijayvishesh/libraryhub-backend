import { AnnouncementTarget } from '../../models/announcement.model';

export type AnnouncementRecord = {
  id: string;
  libraryId: string;
  ownerId: string;
  title: string;
  message: string;
  target: AnnouncementTarget;
  memberIds: string[] | null;
  sentCount: number;
  isActive: boolean;
  expiresAt: Date | null;
  expiryUnit: 'hours' | 'days' | null;
  expiryValue: number | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAnnouncementInput = {
  libraryId: string;
  ownerId: string;
  title: string;
  message: string;
  target: AnnouncementTarget;
   memberIds: string[] | null;
  sentCount: number;
  isActive: boolean;
  expiresAt: Date | null;
  expiryUnit: 'hours' | 'days' | null;
  expiryValue: number | null;
};
