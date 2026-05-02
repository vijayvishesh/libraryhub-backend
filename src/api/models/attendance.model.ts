import { ObjectId } from 'mongodb';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';

export type AttendanceStatus = 'checked_in' | 'checked_out' | 'on_break';

@Entity('attendance')
@Index('idx_attendance_student_id', ['studentId'])
@Index('idx_attendance_library_id', ['libraryId'])
@Index('idx_attendance_date', ['date'])
export class AttendanceModel {
  @ObjectIdColumn()
  id!: ObjectId;

  @Column()
  studentId!: string;

  @Column()
  libraryId!: string;

  @Column()
  membershipId!: string;

  @Column()
  seatId!: string | null;

  @Column()
  studentName!: string;

  @Column()
  date: string;

  @Column()
  checkInTime!: Date;

  @Column()
  checkOutTime!: Date | null;

  @Column()
  status!: AttendanceStatus;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;
}