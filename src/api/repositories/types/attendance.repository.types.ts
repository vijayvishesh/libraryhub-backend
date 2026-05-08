import { AttendanceStatus } from '../../models/attendance.model';

export type AttendanceRecord = {
  id: string;
  studentId: string;
  libraryId: string;
  membershipId: string;
  seatId: string | null;
  studentName: string;
  fromDate?: string,
  toDate?: string,
  checkInTime: Date;
  checkOutTime: Date | null;
  status: AttendanceStatus;
  createdAt: Date;
  updatedAt: Date;
  date: string;
};

export type CreateAttendanceInput = {
  studentId: string;
  libraryId: string;
  membershipId: string;
  seatId: string | null;
  studentName: string;
  fromDate?: string;
  toDate?: string;
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