import { AnnouncementTarget } from '../../models/announcement.model';

export type AnnouncementRecord = {
  id: string;
  libraryId: string;
  ownerId: string;
  title: string;
  message: string;
  target: AnnouncementTarget;
  sentCount: number;
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
  sentCount: number;
};