import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type TimetableDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type TimetableReminder = {
  enabled: boolean;
  minutesBefore?: number;
};

export type TimetableSubject = {
  subjectName: string;
  days: TimetableDay[];
  startTime: string;
  endTime: string;
  color: string;
  reminder: TimetableReminder;
};

@Entity('study_timetables')
@Index('idx_study_timetables_student_id', ['studentId'])
export class StudyTimetableModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  studentId!: string;

  @Column()
  title!: string;

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