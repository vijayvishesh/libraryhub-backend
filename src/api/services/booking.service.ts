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

      // Retire any expired-but-still-active bookings for this seat before
      // inserting, so the partial unique index doesn't block re-booking.
      await this.bookingRepository.expireOldSeatBookings(
        library.id,
        selectedSeat.id,
        slot.slotType,
      );

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
        status:
          payload.paymentMethod === 'razorpay' && payload.razorpayPaymentId
            ? 'confirmed'
            : 'pending_approval',
        checkedInAt: null,
        checkedOutAt: null,
        invoiceNo: this.buildInvoiceNo(),
        utrNumber: payload.utrNumber,
        razorpayOrderId: payload.razorpayOrderId,
        razorpayPaymentId: payload.razorpayPaymentId,
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
        );
      } catch (sideEffectErr: any) {
        // Side effect failure — booking was created successfully, don't rollback
        console.warn('[BookingService] Post-booking side-effect failed:', sideEffectErr?.message);
      }

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
      console.warn('[BookingService] Failed to sync member for booking:', {
        studentId: student.id,
        libraryId: library.id,
        phone: student.phone,
        error: syncError instanceof Error ? syncError.message : syncError,
      });
    }

    try {
    await sendOwnerBookingRequestPush(library.ownerId, student.name, library.name,  bookingId);
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
): Promise<void> {
    // Find existing member FIRST before counting records
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

    // isNewUser = true only if no member records exist anywhere else
    // const allMemberRecords = await this.memberRepository.findAllMembersByPhone(student.phone);
    // const otherLibraryRecords = allMemberRecords.filter(m => m.libraryId !== libraryId);
    // const isNewUser = !existingMember && otherLibraryRecords.length === 0;

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
        // isNewUser intentionally NOT here — preserve original value
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

      // Batch-fetch all libraries to avoid N+1 queries
      const libraryIds = [
        ...new Set(result.bookings.map((b: any) => b.libraryId?.toString()).filter(Boolean)),
      ];
      const libraries = await this.libraryRepository.findManyByIds(libraryIds);
      const libraryMap = new Map(libraries.map((l: any) => [l.id?.toString(), l]));

      // Fetch today's study minutes (from sessions) and attendance data in parallel
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
        // ✅ Always return todayStudyTime regardless of booking status
        return { ...base, todayStudyTime };
      });

      return {
        bookings,
        page,
        limit,
        total: result.total,
        todayStudyTime,
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
    const base    = this.mapBookingResult(booking, library);

    // Always fetch todayStudyTime — not dependent on library or booking status
    const todayStudyTime = await this.studySessionRepository
      .sumTodayDurationMinutes(studentId.trim());

    if (booking.status === 'confirmed') {
      const today = new Date().toISOString().slice(0, 10);
      const records = await this.attendanceRepository.findAllByStudentAndDate(
        studentId.trim(),
        booking.libraryId,
        today,
      );

      const attendanceFields = records.length > 0
        ? this.computeAttendanceFields(records)
        : {};

      const latestRecord    = records[records.length - 1];
      const todayAttendance = latestRecord
        ? {
            checkInTime:  new Date(latestRecord.checkInTime).toISOString(),
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
      duration: number;
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
      studentId: null,
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

    // 1. Validate student
    const student = await this.authRepository.findStudentById(studentId);
    if (!student) throw new NotFoundError('STUDENT_NOT_FOUND');

    // 2. Validate library
    const library = await this.getLibraryOrThrow(payload.libraryId);

    // 3. Find existing member record (must exist for renewal)
    const existingMember = await this.memberRepository.findMemberByStudentIdAndLibrary(
      studentId,
      payload.libraryId,
    );
    if (!existingMember) throw new HttpError(404, 'MEMBER_NOT_FOUND');

    // 4. Find current/last booking for history tracking
    const currentBooking = await this.bookingRepository.findLatestBookingByStudentAndLibrary(
      studentId,
      payload.libraryId,
    );

    // 5. Resolve slot
    const slot = this.getLibrarySlotOrThrow(library, payload.slotId);

    // 6. Resolve seat — keep old seat if student doesn't change it
    const resolvedSeatId = payload.seatId ?? existingMember.seatId;
    const resolvedSectionId = this.resolveSectionIdForLibrary(library, payload.sectionId);

    // 7. Build seat map and validate seat availability
    const seatMap = await this.resolveSeatMapWithFallback(
      library,
      slot.slotType,
      resolvedSectionId || undefined,
    );
    if (seatMap.length === 0) {
      throw new HttpError(409, 'NO_SEAT_AVAILABLE');
    }

    // 8. Resolve seat selection
    const selectedSeat = this.resolveSeatSelection(
      seatMap,
      resolvedSeatId || undefined,
      payload.autoAllocate ?? false,
      student.gender,
    );

    // 9. Check seat conflict — allow same student to renew same seat
    const conflictingBooking = await this.bookingRepository.findActiveSeatBooking(
      library.id,
      slot.slotType,
      selectedSeat.id,
    );
    if (conflictingBooking && conflictingBooking.studentId !== studentId) {
      throw new HttpError(409, 'SEAT_TAKEN');
    }

    // 10. Calculate dates
    const startDate = payload.startDate || new Date().toISOString().slice(0, 10);
    this.assertValidIsoDate(startDate);
    const duration  = payload.duration || 1;
    const validUntil = this.addDaysIsoDate(startDate, duration * 30);
    const planAmount = slot.pricePerMonth * duration;

    // 11. Determine statuses based on who is renewing
    //     Owner → immediately active + confirmed
    //     Student → pending until owner approves
    const newBookingStatus = isOwnerRenewing ? 'confirmed' : 'pending_approval';
    const newMemberStatus  = isOwnerRenewing ? 'active'    : 'pending';

    // 12. Update member status immediately
    await this.memberRepository.updateMemberByIdAndLibrary(
      existingMember.id,
      payload.libraryId,
      {
        status:               newMemberStatus,
        seatId:               selectedSeat.id,
        slotId:               slot.slotType,
        startDate,
        endDate:              validUntil,
        duration,
        planAmount,
        paymentMethod:        payload.paymentMethod ?? null,
        paymentScreenshotUrl: payload.paymentScreenshotUrl ?? null,
        updatedAt:            new Date(),
      },
    );

    // ✅ 13. Mark OLD booking as expired — NEW
    if (currentBooking?.id) {
      await this.bookingRepository.updateBookingStatus(
        currentBooking.id,
        'expired',  // not checked_out — that's for attendance only
      );
    }

    // 14. Expire old seat bookings (partial unique index cleanup)
    await this.bookingRepository.expireOldSeatBookings(
      library.id,
      selectedSeat.id,
      slot.slotType,
    );

    // 15. Create new booking record
    const newBooking = await this.bookingRepository.createBooking({
      libraryId:     library.id,
      studentId:     student.id,
      libraryName:   library.name,
      libraryAddress:`${library.address}, ${library.city}`,
      slotType:      slot.slotType,
      slotName:      slot.name,
      slotStartTime: slot.startTime,
      slotEndTime:   slot.endTime,
      seatId:        selectedSeat.id,
      sectionId:     selectedSeat.sectionId,
      paymentMethod: payload.paymentMethod as LibraryPaymentMethod,
      amount:        planAmount,
      duration,
      startDate,
      validUntil,
      status:        newBookingStatus,
      checkedInAt:   null,
      checkedOutAt:  null,
      invoiceNo:     this.buildInvoiceNo(),
    });

    // ✅ 16. Update member with new bookingId + payment info — UPDATED
    await this.memberRepository.updateMemberByIdAndLibrary(
      existingMember.id,
      payload.libraryId,
      {
        bookingId:            newBooking.id,
        paymentMethod:        payload.paymentMethod ?? null,
        paymentScreenshotUrl: payload.paymentScreenshotUrl ?? null,
        updatedAt:            new Date(),
      },
    );

    // 17. Save renewal history record
    await this.memberRenewalRepository.createRenewal({
      memberId:          existingMember.id,
      studentId:         student.id,
      libraryId:         library.id,
      previousBookingId: currentBooking?.id     || null,
      previousSeatId:    existingMember.seatId,
      previousSlotId:    existingMember.slotId,
      previousEndDate:   existingMember.endDate,
      newBookingId:      newBooking.id,
      newSeatId:         selectedSeat.id,
      newSlotId:         slot.slotType,
      newSlotName:       slot.name,
      newStartDate:      startDate,
      newEndDate:        validUntil,
      duration,
      planAmount,
      paymentMethod:     payload.paymentMethod,
      renewedBy:         payload.renewedBy,
      status:            isOwnerRenewing ? 'approved' : 'pending',
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
}
