import { LibraryPaymentMethod, LibrarySlotType } from '../../constants/library.constants';
import { BookingPaymentStatus, BookingStatus } from '../../models/booking.model';

export type CreateBookingInput = {
  libraryId: string;
  studentId: string;
  libraryName: string;
  libraryAddress: string;
  slotType: LibrarySlotType;
  slotName: string;
  slotStartTime: string;
  slotEndTime: string;
  seatId: string;
  sectionId: string | null;
  paymentMethod: LibraryPaymentMethod;
  amount: number;
  duration: number;
  startDate: string;
  validUntil: string;
  status: BookingStatus;
  paymentStatus?: BookingPaymentStatus | null;   // ← new
  paymentReminderSentAt?: Date | null;            // ← new
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  invoiceNo: string;
  utrNumber?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  paymentScreenshotUrl?: string | null;
};

export type BookingRecord = CreateBookingInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ListStudentBookingsInput = {
  studentId: string;
  page: number;
  limit: number;
};

export type ListStudentBookingsResult = {
  bookings: BookingRecord[];
  total: number;
};

export type ListLibraryFeeBookingsInput = {
  libraryId: string;
  tab: 'pending' | 'received_today';
  fromDate: string;
  toDate: string;
  page: number;
  limit: number;
};

export type ListLibraryFeeBookingsResult = {
  bookings: BookingRecord[];
  total: number;
};

export type FeeCollectionSummary = {
  todayAmount: number;
  todayPayments: number;
  monthAmount: number;
  monthPayments: number;
  pendingCount: number;
};