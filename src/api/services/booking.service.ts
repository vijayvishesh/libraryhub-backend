import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import {
  CreateBookingRequest,
  ListMyBookingsQueryRequest,
  RenewBookingRequest,
} from '../controllers/requests/booking.request';
import {
  buildSeatMap,
  isSeatAllowedForStudent,
  pickAutoSeat,
  SeatMapItem,
  SeatStatus,
} from '../helpers/seatMap.helper';
import { AuthRepository } from '../repositories/auth.repositories';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { AttendanceRecord } from '../repositories/types/attendance.repository.types';
import { BookingRepository } from '../repositories/booking.repository';
import { LibraryRepository } from '../repositories/library.repository';
import { MemberRepository } from '../repositories/member.repository';
import { StudySessionRepository } from '../repositories/studySession.repository';
import { CreateBookingInput } from '../repositories/types/booking.repository.types';
import { LibraryRecord } from '../repositories/types/library.repository.types';
import { LibrarySeatRecord } from '../repositories/types/librarySeat.repository.types';
import { LibrarySeatService } from './librarySeat.service';
import {
  AttendanceSession,
  BookingResult,
  ListMyBookingsResult,
  PaymentMethodOption,
  SeatMapResult,
} from './types/booking.service.types';
import { sendOwnerBookingRequestPush, sendOwnerRenewalRequestPush } from '../../loaders/cronLoader';
import { LibraryPaymentMethod } from '../constants/library.constants';
import { MemberRenewalRepository } from '../repositories/memberRenewal.repository';
import { LibraryPaymentMethodRepository } from '../repositories/libraryPaymentMethod.repository';
import { BookingPaymentStatus } from '../models/booking.model';
import { WebViewService } from './webView.service';

export type { BookingResult, ListMyBookingsResult, PaymentMethodOption, SeatMapResult };

@Service()
export class BookingService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly libraryRepository: LibraryRepository,
    private readonly bookingRepository: BookingRepository,
    private readonly librarySeatService: LibrarySeatService,
    private readonly memberRepository: MemberRepository,
    private readonly attendanceRepository: AttendanceRepository,
    private readonly studySessionRepository: StudySessionRepository,
    private readonly memberRenewalRepository: MemberRenewalRepository,
    private readonly libraryPaymentMethodRepository: LibraryPaymentMethodRepository,
    private readonly webViewService: WebViewService,
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
      const paymentMethods = await this.resolveLibraryPaymentMethodsWithNewTable(library);
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

      const paymentMethods = await this.resolveLibraryPaymentMethodsWithNewTable(library);
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

      await this.bookingRepository.expireOldSeatBookings(
        library.id,
        selectedSeat.id,
        slot.slotType,
      );

      const validUntil = this.addDaysIsoDate(startDate, (payload.duration || 1) * 30);

      // Determine initial paymentStatus based on paymentMethod
      const initialPaymentStatus: BookingPaymentStatus =
        payload.paymentMethod === 'razorpay' && payload.razorpayPaymentId
          ? 'paid'
          : payload.paymentMethod === 'cash'
          ? 'cash_pending'
          : 'not_initiated'; // qr_code / upi — screenshot not uploaded yet

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
        status:
          payload.paymentMethod === 'razorpay' && payload.razorpayPaymentId
            ? 'confirmed'
            : 'pending_approval',
        paymentStatus: initialPaymentStatus,
        checkedInAt: null,
        checkedOutAt: null,
        invoiceNo: this.buildInvoiceNo(),
        utrNumber: payload.utrNumber,
        razorpayOrderId: payload.razorpayOrderId,
        razorpayPaymentId: payload.razorpayPaymentId,
        paymentScreenshotUrl: payload.paymentScreenshotUrl ?? null,
      };

      const booking = await this.bookingRepository.createBooking(bookingToCreate);
      await this.authRepository.updateStudentHasJoinedLibrary(student.id, true);

      try {
        await this.onBookingCreated(
          booking.id,
          student,
          library,
          selectedSeat,
          slot,
          payload,
          startDate,
          validUntil,
          initialPaymentStatus,
        );
      } catch (sideEffectErr: any) {
        console.warn('[BookingService] Post-booking side-effect failed:', sideEffectErr?.message);
      }

      return this.mapBookingResult(booking, library);
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
    paymentStatus: BookingPaymentStatus,
  ): Promise<void> {
    try {

       const pendingReason =
      payload.paymentMethod === 'cash'     ? 'cash_payment_pending' :
      payload.paymentScreenshotUrl         ? 'screenshot_uploaded'  :
      payload.paymentMethod === 'upi' || payload.paymentMethod === 'qr_code' ? 'upi_payment_pending'  :
                                             'waiting_approval';
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
        payload.paymentMethod ?? null,
        payload.paymentScreenshotUrl ?? null,
        paymentStatus,
        pendingReason
      );
    } catch (syncError) {
      console.warn('[BookingService] Failed to sync member for booking:', {
        studentId: student.id,
        libraryId: library.id,
        phone: student.phone,
        error: syncError instanceof Error ? syncError.message : syncError,
      });
    }

    try {
      await sendOwnerBookingRequestPush(library.ownerId, student.name, library.name, bookingId);
    } catch {
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
    memberStatus: 'active' | 'pending' | 'expired' = 'active',
    bookingId: string | null = null,
    duration = 1,
    paymentMethod?: string | null,
    paymentScreenshotUrl?: string | null,
    paymentStatus?: BookingPaymentStatus | null,
    reason?: string | null, 
  ): Promise<void> {
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
        isNewUser: false,
        isInviteSubmission: false,
        paymentMethod: paymentMethod ?? null,
        paymentScreenshotUrl: paymentScreenshotUrl ?? null,
        paymentStatus: paymentStatus ?? null,
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
        paymentMethod: paymentMethod ?? null,
        paymentScreenshotUrl: paymentScreenshotUrl ?? null,
        paymentStatus: paymentStatus ?? null,
        reason: reason ?? null,
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

      const libraryIds = [
        ...new Set(result.bookings.map((b: any) => b.libraryId?.toString()).filter(Boolean)),
      ];
      const libraries = await this.libraryRepository.findManyByIds(libraryIds);
      const libraryMap = new Map(libraries.map((l: any) => [l.id?.toString(), l]));

      const today = new Date().toISOString().slice(0, 10);
      const confirmedLibraryIds = [
        ...new Set(
          result.bookings
            .filter((b: any) => b.status === 'confirmed')
            .map((b: any) => b.libraryId?.toString())
            .filter(Boolean),
        ),
      ];

      const [todayStudyTime, attendanceMap] = await Promise.all([
        this.studySessionRepository.sumTodayDurationMinutes(studentId.trim()),
        (async () => {
          const map = new Map<string, AttendanceRecord[]>();
          await Promise.all(
            confirmedLibraryIds.map(async (libId: string) => {
              const records = await this.attendanceRepository.findAllByStudentAndDate(
                studentId.trim(),
                libId,
                today,
              );
              map.set(libId, records);
            }),
          );
          return map;
        })(),
      ]);

      const bookings = result.bookings.map(item => {
        const base = this.mapBookingResult(item, libraryMap.get(item.libraryId?.toString()));
        if (item.status === 'confirmed') {
          const records = attendanceMap.get(item.libraryId?.toString()) ?? [];
          const attendanceFields = records.length > 0 ? this.computeAttendanceFields(records) : {};
          return { ...base, todayStudyTime, ...attendanceFields };
        }
        return { ...base, todayStudyTime };
      });
      const isWebViewApiNeedToCall = await this.webViewService.getWebViewApiConfig();
      return {
        bookings,
        page,
        limit,
        total: result.total,
        todayStudyTime,
        isWebViewApiNeedToCall,
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

      const library = await this.libraryRepository.findLibraryById(booking.libraryId);
      const base = this.mapBookingResult(booking, library);

      const todayStudyTime = await this.studySessionRepository.sumTodayDurationMinutes(
        studentId.trim(),
      );

      if (booking.status === 'confirmed') {
        const today = new Date().toISOString().slice(0, 10);
        const records = await this.attendanceRepository.findAllByStudentAndDate(
          studentId.trim(),
          booking.libraryId,
          today,
        );

        const attendanceFields = records.length > 0 ? this.computeAttendanceFields(records) : {};

        const latestRecord = records[records.length - 1];
        const todayAttendance = latestRecord
          ? {
              checkInTime: new Date(latestRecord.checkInTime).toISOString(),
              checkOutTime: latestRecord.checkOutTime
                ? new Date(latestRecord.checkOutTime).toISOString()
                : null,
              status: latestRecord.status,
            }
          : undefined;

        return { ...base, todayStudyTime, todayAttendance, ...attendanceFields };
      }

      return { ...base, todayStudyTime };
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
      duration: number;
      paymentScreenshotUrl?: string | null;
      studentId?: string | null;  
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
      duration: booking.duration,
      studentId: booking.studentId ?? null,
      paymentScreenshotUrl: booking.paymentScreenshotUrl ?? null,
      paymentStatus: (booking as any).paymentStatus ?? null,
      paymentReminderSentAt: (booking as any).paymentReminderSentAt ?? null,
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

  private computeAttendanceFields(records: AttendanceRecord[]): {
    libraryStatus: 'CHECKED_IN' | 'CHECKED_OUT';
    libraryUsage: { sessions: AttendanceSession[]; totalDuration: number };
  } {
    const now = new Date();
    let totalSeconds = 0;

    const sessions: AttendanceSession[] = records.map(r => {
      const checkIn = new Date(r.checkInTime);
      const checkOut = r.checkOutTime ? new Date(r.checkOutTime) : now;
      const duration = Math.max(0, Math.floor((checkOut.getTime() - checkIn.getTime()) / 1000));
      totalSeconds += duration;
      return {
        checkInTime: checkIn.toISOString(),
        checkoutTime: r.checkOutTime ? new Date(r.checkOutTime).toISOString() : null,
        duration,
      };
    });

    return {
      libraryStatus: records.some(r => r.status === 'checked_in') ? 'CHECKED_IN' : 'CHECKED_OUT',
      libraryUsage: { sessions, totalDuration: totalSeconds },
    };
  }

  private rethrowBookingError(error: unknown, defaultMessage: string): never {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new InternalServerError(defaultMessage);
  }

  public async renewMembership(
    sessionUserId: string,
    payload: RenewBookingRequest,
  ): Promise<BookingResult> {
    try {
      const isOwnerRenewing = payload.renewedBy === 'owner';
      let studentId: string;

      if (isOwnerRenewing) {
        if (!payload.memberId) {
          throw new HttpError(400, 'MEMBER_ID_REQUIRED_FOR_OWNER_RENEWAL');
        }

        const member = await this.memberRepository.findMemberByIdAndLibrary(
          payload.memberId,
          payload.libraryId,
        );
        if (!member) {
          throw new HttpError(404, 'MEMBER_NOT_FOUND');
        }

        if (!member.studentId) {
          throw new HttpError(400, 'MEMBER_HAS_NO_LINKED_STUDENT');
        }

        studentId = member.studentId;
      } else {
        studentId = sessionUserId;
      }

      const student = await this.authRepository.findStudentById(studentId);
      if (!student) throw new NotFoundError('STUDENT_NOT_FOUND');

      const library = await this.getLibraryOrThrow(payload.libraryId);

      const existingMember = await this.memberRepository.findMemberByStudentIdAndLibrary(
        studentId,
        payload.libraryId,
      );
      if (!existingMember) throw new HttpError(404, 'MEMBER_NOT_FOUND');

      const currentBooking = await this.bookingRepository.findLatestBookingByStudentAndLibrary(
        studentId,
        payload.libraryId,
      );

      const slot = this.getLibrarySlotOrThrow(library, payload.slotId);
      const resolvedSeatId = payload.seatId ?? existingMember.seatId;
      const resolvedSectionId = this.resolveSectionIdForLibrary(library, payload.sectionId);

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
        resolvedSeatId || undefined,
        payload.autoAllocate ?? false,
        student.gender,
      );

      const conflictingBooking = await this.bookingRepository.findActiveSeatBooking(
        library.id,
        slot.slotType,
        selectedSeat.id,
      );
      if (conflictingBooking && conflictingBooking.studentId !== studentId) {
        throw new HttpError(409, 'SEAT_TAKEN');
      }

      const startDate = payload.startDate || new Date().toISOString().slice(0, 10);
      this.assertValidIsoDate(startDate);
      const duration = payload.duration || 1;
      const validUntil = this.addDaysIsoDate(startDate, duration * 30);
      const planAmount = slot.pricePerMonth * duration;

      const newBookingStatus = isOwnerRenewing ? 'confirmed' : 'pending_approval';
      const newMemberStatus = isOwnerRenewing ? 'active' : 'pending';

      // Determine paymentStatus for renewal
      const renewalPaymentStatus: BookingPaymentStatus = isOwnerRenewing
        ? 'paid'
        : payload.paymentMethod === 'cash'
        ? 'cash_pending'
        : 'not_initiated';

      await this.memberRepository.updateMemberByIdAndLibrary(
        existingMember.id,
        payload.libraryId,
        {
          status: newMemberStatus,
          seatId: selectedSeat.id,
          slotId: slot.slotType,
          startDate,
          endDate: validUntil,
          duration,
          planAmount,
          paymentMethod: payload.paymentMethod ?? null,
          paymentScreenshotUrl: payload.paymentScreenshotUrl ?? null,
          paymentStatus: renewalPaymentStatus,
          updatedAt: new Date(),
        },
      );

      if (currentBooking?.id) {
        await this.bookingRepository.updateBookingStatus(currentBooking.id, 'expired');
      }

      await this.bookingRepository.expireOldSeatBookings(
        library.id,
        selectedSeat.id,
        slot.slotType,
      );

      const newBooking = await this.bookingRepository.createBooking({
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
        paymentMethod: payload.paymentMethod as LibraryPaymentMethod,
        amount: planAmount,
        duration,
        startDate,
        validUntil,
        status: newBookingStatus,
        paymentStatus: renewalPaymentStatus,
        checkedInAt: null,
        checkedOutAt: null,
        invoiceNo: this.buildInvoiceNo(),
        paymentScreenshotUrl: payload.paymentScreenshotUrl ?? null,
      });

      await this.memberRepository.updateMemberByIdAndLibrary(existingMember.id, payload.libraryId, {
        bookingId: newBooking.id,
        paymentMethod: payload.paymentMethod ?? null,
        paymentScreenshotUrl: payload.paymentScreenshotUrl ?? null,
        paymentStatus: renewalPaymentStatus,
        updatedAt: new Date(),
      });

      await this.memberRenewalRepository.createRenewal({
        memberId: existingMember.id,
        studentId: student.id,
        libraryId: library.id,
        previousBookingId: currentBooking?.id || null,
        previousSeatId: existingMember.seatId,
        previousSlotId: existingMember.slotId,
        previousEndDate: existingMember.endDate,
        newBookingId: newBooking.id,
        newSeatId: selectedSeat.id,
        newSlotId: slot.slotType,
        newSlotName: slot.name,
        newStartDate: startDate,
        newEndDate: validUntil,
        duration,
        planAmount,
        paymentMethod: payload.paymentMethod,
        renewedBy: payload.renewedBy,
        status: isOwnerRenewing ? 'approved' : 'pending',
      });

      try {
        await sendOwnerRenewalRequestPush(
          library.ownerId,
          student.name,
          library.name,
          existingMember.id,
          payload.paymentMethod,
          payload.paymentScreenshotUrl ?? null,
        );
      } catch (err: any) {
        console.log('Push notification failed:', err.message);
      }

      return this.mapBookingResult(newBooking, library);
    } catch (error) {
      this.rethrowBookingError(error, 'RENEW_MEMBERSHIP_FAILED');
    }
  }

  public async updateBookingPayment(
    studentId: string,
    bookingId: string,
    paymentMethod: string,
    paymentScreenshotUrl?: string | null,
  ): Promise<BookingResult> {
    try {
      const updated = await this.bookingRepository.updatePaymentInfo(
        bookingId,
        studentId,
        paymentMethod,
        paymentScreenshotUrl,
      );

      if (!updated) {
        throw new HttpError(404, 'BOOKING_NOT_FOUND_OR_NOT_UPDATABLE');
      }

      // Determine new paymentStatus
      const newPaymentStatus: BookingPaymentStatus = paymentScreenshotUrl
        ? 'screenshot_uploaded'
        : paymentMethod === 'cash'
        ? 'cash_pending'
        : 'not_initiated';

      // Update paymentStatus on booking
      await this.bookingRepository.updateBookingFields(bookingId, {
        paymentStatus: newPaymentStatus,
        updatedAt: new Date(),
      });

      // Sync to member
      const member = await this.memberRepository.findMemberByStudentIdAndLibrary(
        studentId,
        updated.libraryId,
      );
      if (member) {
        await this.memberRepository.updateMemberByIdAndLibrary(member.id, updated.libraryId, {
          paymentMethod: paymentMethod ?? null,
          paymentScreenshotUrl: paymentScreenshotUrl ?? null,
          paymentStatus: newPaymentStatus,
          updatedAt: new Date(),
        });
      }

      const library = await this.libraryRepository.findLibraryById(updated.libraryId);
      return this.mapBookingResult(updated, library);
    } catch (error) {
      this.rethrowBookingError(error, 'UPDATE_BOOKING_PAYMENT_FAILED');
    }
  }

  private async resolveLibraryPaymentMethodsWithNewTable(
    library: LibraryRecord,
  ): Promise<PaymentMethodOption[]> {
    const pmRecord = await this.libraryPaymentMethodRepository.findByLibraryId(library.id);

    if (pmRecord && pmRecord.methods.length > 0) {
      return pmRecord.methods.map(m => ({
        type: m.type,
        enabled: m.enabled,
        label: m.label,
      }));
    }

    if (library.paymentMethods && library.paymentMethods.length > 0) {
      return library.paymentMethods;
    }

    return [
      { type: 'upi', enabled: true, label: 'UPI' },
      { type: 'cash', enabled: true, label: 'Cash' },
    ];
  }
}