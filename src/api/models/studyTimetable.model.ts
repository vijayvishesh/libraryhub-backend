import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type TimetableDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type TimetableReminder = {
  enabled: boolean;
  minutesBefore?: number; // e.g. 10, 15, 30
};

export type TimetableSubject = {
  subjectName: string;
  days: TimetableDay[];
  startTime: string;   // "HH:mm" 24hr format e.g. "09:00"
  endTime: string;     // "HH:mm" 24hr format e.g. "11:00"
  color: string;       // hex color e.g. "#FF5733"
  reminder: TimetableReminder;
};

@Entity('study_timetables')
@Index('idx_study_timetables_student_id', ['studentId'])
@Index('idx_study_timetables_library_id', ['libraryId'])
export class StudyTimetableModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  studentId!: string;

  @Column()
  title!: string; // e.g. "My Weekly Study Plan"

  @Column()
  subjects!: TimetableSubject[];

  @Column()
  isActive!: boolean;

  @Column()
  deletedAt!: Date | null;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}