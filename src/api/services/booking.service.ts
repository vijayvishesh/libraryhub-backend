import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import {
  CreateBookingRequest,
  ListMyBookingsQueryRequest,
} from '../controllers/requests/booking.request';
import {
  buildSeatMap,
  isSeatAllowedForStudent,
  pickAutoSeat,
  SeatMapItem,
  SeatStatus,
} from '../helpers/seatMap.helper';
import { AuthRepository } from '../repositories/auth.repositories';
import { BookingRepository } from '../repositories/booking.repository';
import { LibraryRepository } from '../repositories/library.repository';
import { MemberRepository } from '../repositories/member.repository';
import { CreateBookingInput } from '../repositories/types/booking.repository.types';
import { LibraryRecord } from '../repositories/types/library.repository.types';
import { LibrarySeatRecord } from '../repositories/types/librarySeat.repository.types';
import { LibrarySeatService } from './librarySeat.service';
import {
  BookingResult,
  ListMyBookingsResult,
  PaymentMethodOption,
  SeatMapResult,
} from './types/booking.service.types';

export type { BookingResult, ListMyBookingsResult, PaymentMethodOption, SeatMapResult };

@Service()
export class BookingService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly libraryRepository: LibraryRepository,
    private readonly bookingRepository: BookingRepository,
    private readonly librarySeatService: LibrarySeatService,
    private readonly memberRepository: MemberRepository,
  ) {}

  public async getLibrarySeatMap(
    libraryId: string,
    slotId?: string,
    sectionId?: string,
  ): Promise<SeatMapResult> {
    try {
      const library = await this.getLibraryOrThrow(libraryId);
      const slot = slotId ? this.getLibrarySlotOrThrow(library, slotId) : undefined;
      const resolvedSectionId = this.resolveSectionIdForLibrary(library, sectionId);
      const seatMap = await this.resolveSeatMapWithFallback(
        library,
        slot?.slotType,
        resolvedSectionId || undefined,
      );

      return {
        libraryId: library.id,
        slotId: slot?.slotType || 'all',
        sectionId: resolvedSectionId || undefined,
        seats: seatMap,
      };
    } catch (error) {
      this.rethrowBookingError(error, 'GET_LIBRARY_SEAT_MAP_FAILED');
    }
  }

  public async getLibraryPaymentOptions(libraryId: string): Promise<PaymentMethodOption[]> {
    try {
      const library = await this.getLibraryOrThrow(libraryId);
      const paymentMethods = this.resolveLibraryPaymentMethods(library);
      return paymentMethods.filter(item => item.enabled);
    } catch (error) {
      this.rethrowBookingError(error, 'GET_LIBRARY_PAYMENT_OPTIONS_FAILED');
    }
  }

  public async createBooking(
    studentId: string,
    payload: CreateBookingRequest,
  ): Promise<BookingResult> {
    try {
      const student = await this.authRepository.findStudentById(studentId);
      if (!student) {
        throw new NotFoundError('STUDENT_NOT_FOUND');
      }

      const library = await this.getLibraryOrThrow(payload.libraryId);
      if (!library.isOpen || !library.isActive) {
        throw new HttpError(409, 'LIBRARY_NOT_AVAILABLE');
      }

      // Prevent duplicate active booking by same student in same library
      const existingBooking = await this.bookingRepository.findActiveStudentBookingInLibrary(
        student.id,
        library.id,
      );
      if (existingBooking) {
        throw new HttpError(409, 'ALREADY_BOOKED_IN_LIBRARY');
      }

      const slot = this.getLibrarySlotOrThrow(library, payload.slotId);
      const resolvedSectionId = this.resolveSectionIdForLibrary(library, payload.sectionId);
      const startDate = payload.startDate || new Date().toISOString().slice(0, 10);
      this.assertValidIsoDate(startDate);

      const paymentMethods = this.resolveLibraryPaymentMethods(library);
      const selectedPaymentMethod = paymentMethods.find(
        item => item.type === payload.paymentMethod,
      );
      if (!selectedPaymentMethod || !selectedPaymentMethod.enabled) {
        throw new HttpError(400, 'PAYMENT_METHOD_NOT_ALLOWED');
      }

      const seatMap = await this.resolveSeatMapWithFallback(
        library,
        slot.slotType,
        resolvedSectionId || undefined,
      );
      if (seatMap.length === 0) {
        throw new HttpError(409, 'NO_SEAT_AVAILABLE');
      }

      const selectedSeat = this.resolveSeatSelection(
        seatMap,
        payload.seatId,
        payload.autoAllocate ?? false,
        student.gender,
      );

      const conflictingBooking = await this.bookingRepository.findActiveSeatBooking(
        library.id,
        slot.slotType,
        selectedSeat.id,
      );
      if (conflictingBooking) {
        throw new HttpError(409, 'SEAT_TAKEN');
      }

      const validUntil = this.addDaysIsoDate(startDate, (payload.duration || 1) * 30);
      const bookingToCreate: CreateBookingInput = {
        libraryId: library.id,
        studentId: student.id,
        libraryName: library.name,
        libraryAddress: `${library.address}, ${library.city}`,
        slotType: slot.slotType,
        slotName: slot.name,
        slotStartTime: slot.startTime,
        slotEndTime: slot.endTime,
        seatId: selectedSeat.id,
        sectionId: selectedSeat.sectionId,
        paymentMethod: payload.paymentMethod,
        amount: slot.pricePerMonth * (payload.duration || 1),
        duration: payload.duration || 1,
        startDate,
        validUntil,
        status: 'pending_approval',
        checkedInAt: null,
        checkedOutAt: null,
        invoiceNo: this.buildInvoiceNo(),
      };

      const booking = await this.bookingRepository.createBooking(bookingToCreate);
      await this.authRepository.updateStudentHasJoinedLibrary(student.id, true);
      await this.onBookingCreated(
        booking.id,
        student,
        library,
        selectedSeat,
        slot,
        payload,
        startDate,
        validUntil,
      );

      return this.mapBookingResult(booking, library); //  pass library here
    } catch (error) {
      this.rethrowBookingError(error, 'CREATE_BOOKING_FAILED');
    }
  }

  private async onBookingCreated(
    bookingId: string,
    student: { id: string; name: string; phone: string },
    library: LibraryRecord,
    selectedSeat: SeatMapItem,
    slot: { slotType: string; pricePerMonth: number },
    payload: CreateBookingRequest,
    startDate: string,
    validUntil: string,
  ): Promise<void> {
    try {
      await this.syncMemberForBooking(
        student,
        library.id,
        selectedSeat.id,
        slot.slotType,
        slot.pricePerMonth * (payload.duration || 1),
        startDate,
        validUntil,
        'pending',
        bookingId,
        payload.duration || 1,
      );
    } catch (syncError) {
      console.error('Failed to sync member for booking:', {
        studentId: student.id,
        libraryId: library.id,
        phone: student.phone,
        error: syncError instanceof Error ? syncError.message : syncError,
      });
    }
  }

  private async syncMemberForBooking(
    student: { id: string; name: string; phone: string },
    libraryId: string,
    seatId: string,
    slotId: string,
    planAmount: number,
    startDate: string,
    endDate: string,
    memberStatus: 'active' | 'pending' = 'active',
    bookingId: string | null = null,
    duration = 1,
  ): Promise<void> {
    // Check by studentId first, then by mobileNo (owner may have added member manually)
    let existingMember = await this.memberRepository.findMemberByStudentIdAndLibrary(
      student.id,
      libraryId,
    );
    if (!existingMember) {
      existingMember = await this.memberRepository.findMemberByLibraryMobileOrAadhar(
        libraryId,
        student.phone,
      );
    }
    if (!existingMember) {
      await this.memberRepository.createMember({
        fullName: student.name,
        mobileNo: student.phone,
        aadharId: null,
        studentId: student.id,
        email: null,
        duration,
        libraryId,
        seatId,
        slotId,
        status: memberStatus,
        planAmount,
        startDate,
        endDate,
        bookingId,
        paidAt: null,
        notes: null,
      });
    } else {
      await this.memberRepository.updateMemberByIdAndLibrary(existingMember.id, libraryId, {
        studentId: student.id,
        bookingId,
        seatId,
        slotId,
        status: memberStatus,
        planAmount,
        startDate,
        endDate,
        updatedAt: new Date(),
      });
    }
  }

  public async listMyBookings(
    studentId: string,
    query: ListMyBookingsQueryRequest,
  ): Promise<ListMyBookingsResult> {
    try {
      const page = query.page ?? 1;
      const limit = query.limit ?? 20;

      const result = await this.bookingRepository.listStudentBookings({
        studentId: studentId.trim(),
        page,
        limit,
      });

      //  only change: fetch library for each booking
      const bookings = await Promise.all(
        result.bookings.map(async item => {
          const library = await this.libraryRepository.findLibraryById(item.libraryId);
          return this.mapBookingResult(item, library);
        }),
      );

      return {
        bookings,
        page,
        limit,
        total: result.total,
      };
    } catch (error) {
      this.rethrowBookingError(error, 'GET_MY_BOOKINGS_FAILED');
    }
  }

  public async getMyBookingById(studentId: string, bookingId: string): Promise<BookingResult> {
    try {
      const booking = await this.bookingRepository.findStudentBookingById(
        studentId.trim(),
        bookingId.trim(),
      );
      if (!booking) {
        throw new NotFoundError('BOOKING_NOT_FOUND');
      }

      // only change: fetch library and pass to mapBookingResult
      const library = await this.libraryRepository.findLibraryById(booking.libraryId);
      return this.mapBookingResult(booking, library);
    } catch (error) {
      this.rethrowBookingError(error, 'GET_MY_BOOKING_FAILED');
    }
  }

  private resolveSeatSelection(
    seatMap: SeatMapItem[],
    requestedSeatId: string | undefined,
    autoAllocate: boolean,
    studentGender: 'male' | 'female' | 'other',
  ): SeatMapItem {
    if (autoAllocate || !requestedSeatId) {
      const autoSeat = pickAutoSeat(seatMap, studentGender);
      if (autoSeat) {
        return autoSeat;
      }

      const hasUnoccupiedSeat = seatMap.some(item => !item.occupied);
      if (hasUnoccupiedSeat) {
        throw new HttpError(403, 'GENDER_RESTRICTED');
      }

      throw new HttpError(409, 'NO_SEAT_AVAILABLE');
    }

    const selectedSeat = seatMap.find(item => item.id === requestedSeatId.trim());
    if (!selectedSeat) {
      throw new NotFoundError('SEAT_NOT_FOUND');
    }

    if (selectedSeat.occupied) {
      throw new HttpError(409, 'SEAT_TAKEN');
    }

    if (!isSeatAllowedForStudent(selectedSeat.gender, studentGender)) {
      throw new HttpError(403, 'GENDER_RESTRICTED');
    }

    return selectedSeat;
  }

  private resolveSectionIdForLibrary(
    library: LibraryRecord,
    sectionId: string | undefined,
  ): string | null {
    const isSectionMode = library.seating?.mode === 'section';
    if (!isSectionMode) {
      return null;
    }

    if (!sectionId) {
      return null;
    }

    const sectionExists = library.seating?.sections?.some(
      section => String(section.id) === sectionId.trim(),
    );
    if (!sectionExists) {
      throw new NotFoundError('SECTION_NOT_FOUND');
    }

    return sectionId.trim();
  }

  private buildSeatMapFromInventory(
    seatInventory: LibrarySeatRecord[],
    seatStatusMap: Map<string, SeatStatus>,
  ): SeatMapItem[] {
    return seatInventory.map(seat => {
      const status = seatStatusMap.get(seat.seatId) || 'available';
      return {
        id: seat.seatId,
        label: seat.label,
        gender: seat.gender,
        occupied: status !== 'available',
        seatStatus: status,
        sectionId: seat.sectionId,
      };
    });
  }

  private async resolveSeatMapWithFallback(
    library: LibraryRecord,
    slotType?: string,
    sectionId?: string,
  ): Promise<SeatMapItem[]> {
    const [bookingSeatStatus, memberSeatStatus] = await Promise.all([
      this.bookingRepository.findActiveSeatStatusByLibraryAndSlot(library.id, slotType, sectionId),
      this.memberRepository.findActiveMemberSeatStatus(library.id, slotType, sectionId),
    ]);

    // Merge: booking status takes priority, then member status
    const seatStatusMap = new Map<string, SeatStatus>(bookingSeatStatus);
    for (const [seatId, status] of memberSeatStatus) {
      if (!seatStatusMap.has(seatId)) {
        seatStatusMap.set(seatId, status);
      }
    }

    try {
      await this.librarySeatService.ensureLibrarySeatInventory(library);
      const seatInventory = await this.librarySeatService.listLibrarySeats(library.id, sectionId);
      if (seatInventory.length > 0) {
        return this.buildSeatMapFromInventory(seatInventory, seatStatusMap);
      }
    } catch {
      // fallback to computed seat map when inventory is not ready
    }

    return buildSeatMap(library.seating, library.totalSeats, seatStatusMap, sectionId);
  }

  private getLibrarySlotOrThrow(library: LibraryRecord, slotId: string) {
    const slot = library.slots.find(item => item.slotType === slotId && item.isActive);
    if (!slot) {
      throw new NotFoundError('SLOT_NOT_FOUND');
    }

    return slot;
  }

  private resolveLibraryPaymentMethods(library: LibraryRecord): PaymentMethodOption[] {
    if (library.paymentMethods && library.paymentMethods.length > 0) {
      return library.paymentMethods;
    }

    return [
      { type: 'upi', enabled: true, label: 'UPI' },
      { type: 'cash', enabled: true, label: 'Cash' },
    ];
  }

  private async getLibraryOrThrow(libraryId: string): Promise<LibraryRecord> {
    const library = await this.libraryRepository.findLibraryById(libraryId.trim());
    if (!library || library.deletedAt) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }

    return library;
  }

  private mapBookingResult(
    booking: {
      id: string;
      libraryId: string;
      libraryName: string;
      seatId: string;
      slotType: string;
      slotName: string;
      slotStartTime: string;
      slotEndTime: string;
      sectionId: string | null;
      paymentMethod: string;
      amount: number;
      startDate: string;
      validUntil: string;
      status: string;
      invoiceNo: string;
      libraryAddress: string;
    },
    library?: LibraryRecord | null,
  ): BookingResult {
    return {
      id: booking.id,
      libraryId: booking.libraryId,
      libraryName: booking.libraryName,
      seatId: booking.seatId,
      slotId: booking.slotType,
      slotName: booking.slotName,
      time: `${booking.slotStartTime} - ${booking.slotEndTime}`,
      sectionId: booking.sectionId,
      paymentMethod: booking.paymentMethod,
      amount: booking.amount,
      date: booking.startDate,
      validUntil: booking.validUntil,
      status: booking.status,
      invoiceNo: booking.invoiceNo,
      libraryAddress: library?.address ?? booking.libraryAddress,
      libraryCity: library?.city ?? '',
      libraryState: library?.state ?? '',
      libraryPincode: library?.pincode ?? '',
      libraryLatitude: library?.location?.coordinates?.[1] ?? null,
      libraryLongitude: library?.location?.coordinates?.[0] ?? null,
    };
  }

  private buildInvoiceNo(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = `${Math.floor(Math.random() * 1_000_000)}`.padStart(6, '0');
    return `INV-${datePart}-${random}`;
  }

  private addDaysIsoDate(isoDate: string, daysToAdd: number): string {
    const date = new Date(`${isoDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new HttpError(400, 'INVALID_START_DATE');
    }

    date.setUTCDate(date.getUTCDate() + daysToAdd);
    return date.toISOString().slice(0, 10);
  }

  private assertValidIsoDate(isoDate: string): void {
    const parsedDate = new Date(`${isoDate}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new HttpError(400, 'INVALID_START_DATE');
    }

    if (parsedDate.toISOString().slice(0, 10) !== isoDate) {
      throw new HttpError(400, 'INVALID_START_DATE');
    }
  }

  private rethrowBookingError(error: unknown, defaultMessage: string): never {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new InternalServerError(defaultMessage);
  }
}
