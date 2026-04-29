import { LibraryPaymentMethod, LibrarySlotType } from '../../constants/library.constants';
import { BookingStatus } from '../../models/booking.model';

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
  startDate: string;
  validUntil: string;
  status: BookingStatus;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  invoiceNo: string;
  duration: number;
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
