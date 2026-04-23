import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

@Entity('study_sessions')
@Index('idx_study_sessions_student_id', ['studentId'])
export class StudySessionModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  studentId!: string;

  @Column()
  libraryId!: string | null;

  // @Column()
  // bookingId!: string | null;
  @Column()
  studyDuration!: number;

  @Column()
  startTime!: string; // HH:mm

  @Column()
  endTime!: string; // HH:mm

  @Column()
  durationMinutes!: number;

  @Column()
  notes!: string | null;

  @Column()
  revisionReminderDays!: number | null;

  @Column()
  revisionReminderDate!: Date | null;

  @Column()
  deletedAt!: Date | null;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}