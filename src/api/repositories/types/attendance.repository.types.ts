import { AttendanceStatus } from '../../models/attendance.model';

export type AttendanceRecord = {
  id: string;
  studentId: string;
  libraryId: string;
  membershipId: string;
  seatId: string | null;
  studentName: string;
  date: string;
  checkInTime: Date;
  checkOutTime: Date | null;
  status: AttendanceStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAttendanceInput = {
  studentId: string;
  libraryId: string;
  membershipId: string;
  seatId: string | null;
  studentName: string;
  date: string;
  checkInTime: Date;
};

export type UpdateAttendanceInput = {
  checkOutTime?: Date;
  status?: AttendanceStatus;
};

export type TodayAttendanceSummary = {
  present: number;
  onBreak: number;
  absent: number;
};