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

export type BookingResult = {
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
};

export type ListMyBookingsResult = {
  bookings: BookingResult[];
  page: number;
  limit: number;
  total: number;
};
