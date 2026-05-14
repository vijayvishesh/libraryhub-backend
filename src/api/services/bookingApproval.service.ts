import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { getFirebaseMessaging } from '../../lib/firebase/firebase';
import { LibraryPaymentMethod } from '../constants/library.constants';
import { AuthRepository } from '../repositories/auth.repositories';
import { BookingRepository } from '../repositories/booking.repository';
import { FcmTokenRepository } from '../repositories/fcmToken.repository';
import { LibraryRepository } from '../repositories/library.repository';
import { MemberRepository } from '../repositories/member.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { LibraryRecord } from '../repositories/types/library.repository.types';
import { BookingResult } from './types/booking.service.types';

@Service()
export class BookingApprovalService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly libraryRepository: LibraryRepository,
    private readonly bookingRepository: BookingRepository,
    private readonly memberRepository: MemberRepository,
    private readonly notificationRepository: NotificationRepository,
    private readonly fcmTokenRepository: FcmTokenRepository,
  ) {}

  public async approveBooking(
    ownerId: string,
    bookingId: string,
    markPaid = false,
    paymentMethod?: string,
  ): Promise<BookingResult> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const booking = await this.bookingRepository.findLibraryBookingById(library.id, bookingId);
      if (!booking) {
        throw new NotFoundError('BOOKING_NOT_FOUND');
      }

      if (booking.status !== 'pending_approval') {
        throw new HttpError(409, 'BOOKING_NOT_PENDING_APPROVAL');
      }

      // Check if owner already changed the seat via updateMember before approval
      // If so, use the member's current seat as the final seat (owner's decision wins)
      const student = await this.authRepository.findStudentById(booking.studentId);
      let finalSeatId = booking.seatId; // default: what student originally booked

      if (student) {
        const existingMember = await this.memberRepository.findMemberByStudentIdAndLibrary(
          student.id,
          library.id,
        );
        // Owner changed seat on member record — use that as the final seat
        if (existingMember?.seatId && existingMember.seatId !== booking.seatId) {
          finalSeatId = existingMember.seatId;
        }
      }

      // Sync booking record's seatId if owner changed it
      // This frees the original seat and locks only the new one
      if (finalSeatId !== booking.seatId) {
        await this.bookingRepository.updateBookingSeatId(bookingId, finalSeatId);
      }

      const targetStatus = markPaid ? 'confirmed' : 'pending_payment';
      const memberStatus = markPaid ? 'active' : 'pending';

      const updated = markPaid
        ? await this.bookingRepository.markBookingPaid(
            bookingId,
            paymentMethod as LibraryPaymentMethod | undefined,
          )
        : await this.bookingRepository.updateBookingStatus(bookingId, targetStatus);

      if (!updated) {
        throw new InternalServerError('APPROVE_BOOKING_FAILED');
      }

      if (student) {
        try {
          await this.syncMemberForBooking(
            student,
            library.id,
            finalSeatId, // ← resolved seat (owner's choice or student's original)
            booking.slotType,
            booking.amount,
            booking.startDate,
            booking.validUntil,
            memberStatus,
            bookingId,
            booking.duration,
          );
        } catch (_syncError) {
          // Roll back booking status so owner can retry
          console.error('Member sync failed after booking approval:', _syncError);
          await this.bookingRepository.updateBookingStatus(bookingId, 'pending_approval');
          throw new InternalServerError('APPROVE_BOOKING_MEMBER_SYNC_FAILED');
        }
      }

      const notifMessage = markPaid
        ? `Booking approved & paid for seat ${finalSeatId}`
        : `Confirmed! Pay ₹${booking.amount} at counter for seat ${finalSeatId}`;

      await this.createAndPushNotification(
        booking.studentId,
        'Booking Approved',
        notifMessage,
        bookingId,
      );

      return this.mapBookingResult(updated, library);
    } catch (error) {
      this.rethrowError(error, 'APPROVE_BOOKING_FAILED');
    }
  }

  public async rejectBooking(ownerId: string, bookingId: string): Promise<BookingResult> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const booking = await this.bookingRepository.findLibraryBookingById(library.id, bookingId);
      if (!booking) {
        throw new NotFoundError('BOOKING_NOT_FOUND');
      }

      if (booking.status !== 'pending_approval') {
        throw new HttpError(409, 'BOOKING_NOT_PENDING_APPROVAL');
      }

      const updated = await this.bookingRepository.updateBookingStatus(bookingId, 'rejected');
      if (!updated) {
        throw new InternalServerError('REJECT_BOOKING_FAILED');
      }

      const existingMember = await this.memberRepository.findMemberByStudentIdAndLibrary(
        booking.studentId,
        library.id,
      );
      if (existingMember && existingMember.status === 'pending') {
        await this.memberRepository.deleteMemberByIdAndLibrary(existingMember.id, library.id);
      }

      await this.createAndPushNotification(
        booking.studentId,
        'Booking Rejected',
        `Your booking request for seat ${booking.seatId} has been rejected`,
        bookingId,
      );

      return this.mapBookingResult(updated, library);
    } catch (error) {
      this.rethrowError(error, 'REJECT_BOOKING_FAILED');
    }
  }

  public async markBookingPaidByOwner(
    ownerId: string,
    bookingId: string,
    paymentMethod?: string,
  ): Promise<BookingResult> {
    try {
      const library = await this.getOwnerLibraryOrThrow(ownerId);
      const booking = await this.bookingRepository.findLibraryBookingById(library.id, bookingId);
      if (!booking) {
        throw new NotFoundError('BOOKING_NOT_FOUND');
      }

      if (booking.status !== 'pending_payment' && booking.status !== 'pending_approval') {
        throw new HttpError(409, 'BOOKING_NOT_PENDING');
      }

      const updated = await this.bookingRepository.markBookingPaid(
        bookingId,
        paymentMethod as LibraryPaymentMethod | undefined,
      );
      if (!updated) {
        throw new InternalServerError('MARK_PAID_FAILED');
      }

      const student = await this.authRepository.findStudentById(booking.studentId);
      if (student) {
        await this.syncMemberForBooking(
          student,
          library.id,
          booking.seatId,
          booking.slotType,
          booking.amount,
          booking.startDate,
          booking.validUntil,
          'active',
          bookingId,
          booking.duration,
        );
      }

      return this.mapBookingResult(updated, library);
    } catch (error) {
      this.rethrowError(error, 'MARK_BOOKING_PAID_FAILED');
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
    memberStatus: 'active' | 'pending',
    bookingId: string | null = null,
    duration = 1,
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

    // Calculate isNewUser at approval time:
    // Exclude the member record created by THIS booking from the count
    // so isNewUser reflects whether student existed BEFORE this booking
    const allMemberRecords = await this.memberRepository.findAllMembersByPhone(student.phone);
    const otherRecords = allMemberRecords.filter(
      m => !(m.libraryId === libraryId && m.bookingId === bookingId),
    );
    const isNewUser = otherRecords.length === 0;

    if (!existingMember) {
      await this.memberRepository.createMember({
        fullName: student.name,
        mobileNo: student.phone,
        aadharId: null,
        studentId: student.id,
        email: null,
        duration,
        libraryId,
        seatId, // ← final resolved seat
        slotId,
        status: memberStatus,
        planAmount,
        startDate,
        endDate,
        bookingId,
        paidAt: memberStatus === 'active' ? new Date() : null,
        notes: null,
        isNewUser,
        isInviteSubmission: false,
      });
    } else {
      await this.memberRepository.updateMemberByIdAndLibrary(existingMember.id, libraryId, {
        studentId: student.id,
        bookingId,
        seatId, // ← final resolved seat (overwrites any intermediate change)
        slotId,
        status: memberStatus,
        planAmount,
        startDate,
        endDate,
        paidAt: memberStatus === 'active' ? new Date() : undefined,
        isNewUser, // ← correctly calculated at approval time
        updatedAt: new Date(),
      });
    }
  }

  private async getOwnerLibraryOrThrow(ownerId: string): Promise<LibraryRecord> {
    const library = await this.libraryRepository.findLibraryByOwnerId(ownerId.trim());
    if (!library || library.deletedAt) {
      throw new NotFoundError('LIBRARY_NOT_FOUND');
    }
    return library;
  }

  private async createAndPushNotification(
    studentId: string,
    title: string,
    message: string,
    referenceId: string,
  ): Promise<void> {
    try {
      await this.notificationRepository.createMany([
        {
          studentId,
          title,
          message,
          type: 'system',
          referenceId,
        },
      ]);

      const tokens = await this.fcmTokenRepository.findTokensByStudentIds([studentId]);
      if (tokens.length > 0) {
        const messaging = getFirebaseMessaging();
        await messaging.sendEachForMulticast({
          tokens,
          notification: { title, body: message },
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
      }
    } catch (error) {
      console.error('Notification send failed:', error);
    }
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
    };
  }

  private rethrowError(error: unknown, defaultMessage: string): never {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new InternalServerError(defaultMessage);
  }
}
