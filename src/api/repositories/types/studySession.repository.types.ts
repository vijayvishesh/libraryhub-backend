export type StudySessionRecord = {
  id: string;
  studentId: string;
  libraryId: string | null;
  // bookingId: string | null;
  studyDuration: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  notes: string | null;
  revisionReminderDays: number | null;
  revisionReminderDate: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateStudySessionInput = {
  studentId: string;
  libraryId: string | null;
  // bookingId: string | null;
  studyDuration: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  notes: string | null;
  revisionReminderDays: number | null;
  revisionReminderDate: Date | null;
};

export type UpdateStudySessionInput = {
  notes?: string | null;
  revisionReminderDays?: number | null;
  revisionReminderDate?: Date | null;
};

export type StudySessionStatsRecord = {
  totalSessions: number;
  totalMinutes: number;
  dayStreak: number;
};