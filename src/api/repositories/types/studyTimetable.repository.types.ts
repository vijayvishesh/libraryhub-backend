// import { ObjectId } from 'mongodb';
import { TimetableSubject } from '../../models/studyTimetable.model';

// ─── Record (what comes out of DB) ───────────────────────────────────────────

export type StudyTimetableRecord = {
  id: string;
  studentId: string;
  title: string;
  subjects: TimetableSubject[];
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Input Types (what goes into DB) ─────────────────────────────────────────

export type CreateStudyTimetableInput = {
  studentId: string;
  title: string;
  subjects: TimetableSubject[];
};

export type UpdateStudyTimetableInput = {
  title?: string;
  subjects?: TimetableSubject[];
  isActive?: boolean;
};