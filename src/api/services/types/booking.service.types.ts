import { SeatMapItem } from '../../helpers/seatMap.helper';

export type PaymentMethodOption = {
  type: string;
  label: string;
  enabled: boolean;
};

export type SeatMapResult = {
  libraryId: string;
  slotId: string;
  sectionId?: string;
  seats: SeatMapItem[];
};

export type AttendanceSession = {
  checkInTime: string;
  checkoutTime: string | null;
  duration: number;
};

export type TodayAttendance = {
  checkInTime: string;
  checkOutTime: string | null;
  status: string;
};

export type BookingResult = {
  duration: number;
  id: string;
  libraryId: string;
  libraryName: string;
  seatId: string;
  slotId: string;
  slotName: string;
  time: string;
  sectionId: string | null;
  paymentMethod: string;
  amount: number;
  date: string;
  validUntil: string;
  status: string;
  invoiceNo: string;
  libraryAddress: string;
  libraryCity: string;
  libraryState: string;
  libraryPincode: string;
  libraryLatitude: number | null;
  libraryLongitude: number | null;
  studentId: string | null;
    paymentStatus?: string | null;           // ← new
  paymentReminderSentAt?: Date | null; 
  paymentScreenshotUrl: string | null;
  todayStudyTime?: number; // total minutes from today's study sessions
   todayAttendance?: TodayAttendance;
  libraryStatus?: 'CHECKED_IN' | 'CHECKED_OUT';
  libraryUsage?: { sessions: AttendanceSession[]; totalDuration: number };
};

export type ListMyBookingsResult = {
  bookings: BookingResult[];
  page: number;
  limit: number;
  total: number;
  todayStudyTime: number;
  isWebViewApiNeedToCall: boolean;
};
