import { ObjectId } from 'mongodb';
import { Service } from 'typedi';
import { MongoRepository } from 'typeorm';
import { getDataSource } from '../../database/config/ormconfig.default';
import { LibraryPaymentMethod } from '../constants/library.constants';
import { BookingModel, BookingStatus } from '../models/booking.model';
import {
  BookingRecord,
  CreateBookingInput,
  FeeCollectionSummary,
  ListLibraryFeeBookingsInput,
  ListLibraryFeeBookingsResult,
  ListStudentBookingsInput,
  ListStudentBookingsResult,
} from './types/booking.repository.types';

type WithObjectId = {
  id: ObjectId;
};

const ACTIVE_BOOKING_STATUSES = [
  'confirmed',
  'checked_in',
  'pending_approval',
  'pending_payment',
] as const;
const PAID_BOOKING_STATUSES = ['confirmed', 'checked_in', 'checked_out'] as const;

@Service()
export class BookingRepository {
  private indexesEnsured = false;

  public async createBooking(input: CreateBookingInput): Promise<BookingRecord> {
    await this.ensureIndexes();

    const bookingRepository = this.getBookingRepository();
    const now = new Date();
    const booking = bookingRepository.create({
      ...input,
      createdAt: now,
      updatedAt: now,
    });

    const savedBooking = await bookingRepository.save(booking);
    return this.mapBooking(savedBooking);
  }

  public async findActiveStudentBookingInLibrary(
    studentId: string,
    libraryId: string,
  ): Promise<BookingRecord | null> {
    const todayIsoDate = new Date().toISOString().slice(0, 10);
    const bookings = await this.getBookingRepository().find({
      where: {
        studentId,
        libraryId,
        status: { $in: [...ACTIVE_BOOKING_STATUSES] },
        validUntil: { $gte: todayIsoDate },
      },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    const booking = bookings[0];
    if (!booking) {
      return null;
    }

    return this.mapBooking(booking);
  }

  public async findActiveSeatBooking(
    libraryId: string,
    slotType: string,
    seatId: string,
  ): Promise<BookingRecord | null> {
    const todayIsoDate = new Date().toISOString().slice(0, 10);
    const bookings = await this.getBookingRepository().find({
      where: {
        libraryId,
        slotType,
        seatId,
        status: { $in: [...ACTIVE_BOOKING_STATUSES] },
        validUntil: { $gte: todayIsoDate },
      },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const booking = bookings[0];

    if (!booking) {
      return null;
    }

    return this.mapBooking(booking);
  }

  public async findActiveSeatStatusByLibraryAndSlot(
    libraryId: string,
    slotType?: string,
    sectionId?: string,
  ): Promise<Map<string, 'pending' | 'occupied'>> {
    const todayIsoDate = new Date().toISOString().slice(0, 10);
    const whereFilter: Record<string, unknown> = {
      libraryId,
      status: { $in: [...ACTIVE_BOOKING_STATUSES] },
      validUntil: { $gte: todayIsoDate },
    };

    if (slotType) {
      whereFilter.slotType = slotType;
    }

    if (sectionId) {
      whereFilter.sectionId = sectionId;
    }

    const bookings = await this.getBookingRepository().find({
      where: whereFilter,
    });

    const statusMap = new Map<string, 'pending' | 'occupied'>();
    for (const booking of bookings) {
      const isPending =
        booking.status === 'pending_approval' || booking.status === 'pending_payment';
      statusMap.set(booking.seatId, isPending ? 'pending' : 'occupied');
    }

    return statusMap;
  }

  public async findActiveSeatIdsByLibraryAndSlot(
    libraryId: string,
    slotType?: string,
  ): Promise<string[]> {
    const statusMap = await this.findActiveSeatStatusByLibraryAndSlot(libraryId, slotType);
    return [...statusMap.keys()];
  }

  public async listStudentBookings(
    input: ListStudentBookingsInput,
  ): Promise<ListStudentBookingsResult> {
    const bookingRepository = this.getBookingRepository();
    const whereFilter = {
      studentId: input.studentId,
    };

    const [bookings, total] = await Promise.all([
      bookingRepository.find({
        where: whereFilter,
        order: { createdAt: 'DESC' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      bookingRepository.count({ where: whereFilter }),
    ]);

    return {
      bookings: bookings.map(item => this.mapBooking(item)),
      total,
    };
  }

  public async listLibraryFeeBookings(
    input: ListLibraryFeeBookingsInput,
  ): Promise<ListLibraryFeeBookingsResult> {
    await this.ensureIndexes();

    const bookingRepository = this.getBookingRepository();
    const startDateUtc = new Date(`${input.fromDate}T00:00:00.000Z`);
    const endDateExclusiveUtc = new Date(`${input.toDate}T00:00:00.000Z`);
    endDateExclusiveUtc.setUTCDate(endDateExclusiveUtc.getUTCDate() + 1);

    const whereFilter: Record<string, unknown> = {
      libraryId: input.libraryId,
    };

    if (input.tab === 'pending') {
      whereFilter.status = 'pending';
    } else {
      whereFilter.status = { $in: [...PAID_BOOKING_STATUSES] };
      whereFilter.updatedAt = { $gte: startDateUtc, $lt: endDateExclusiveUtc };
    }

    const [bookings, total] = await Promise.all([
      bookingRepository.find({
        where: whereFilter,
        order: { updatedAt: 'DESC' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      bookingRepository.count({ where: whereFilter }),
    ]);

    return {
      bookings: bookings.map(item => this.mapBooking(item)),
      total,
    };
  }

  public async getFeeCollectionSummary(libraryId: string): Promise<FeeCollectionSummary> {
    await this.ensureIndexes();

    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const bookingRepository = this.getBookingRepository();

    const [todayRows, monthRows, pendingCount] = await Promise.all([
      bookingRepository
        .aggregate([
          {
            $match: {
              libraryId,
              status: { $in: [...PAID_BOOKING_STATUSES] },
              updatedAt: { $gte: startOfToday, $lt: startOfTomorrow },
            },
          },
          {
            $group: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              _id: null,
              amount: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      bookingRepository
        .aggregate([
          {
            $match: {
              libraryId,
              status: { $in: [...PAID_BOOKING_STATUSES] },
              updatedAt: { $gte: startOfMonth, $lt: startOfTomorrow },
            },
          },
          {
            $group: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              _id: null,
              amount: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      bookingRepository.count({
        where: {
          libraryId,
          status: 'pending',
        },
      }),
    ]);

    const todayRow = todayRows[0];
    const monthRow = monthRows[0];

    return {
      todayAmount: todayRow?.amount || 0,
      todayPayments: todayRow?.count || 0,
      monthAmount: monthRow?.amount || 0,
      monthPayments: monthRow?.count || 0,
      pendingCount,
    };
  }

  public async findStudentBookingById(
    studentId: string,
    bookingId: string,
  ): Promise<BookingRecord | null> {
    const objectId = this.tryParseObjectId(bookingId);
    if (!objectId) {
      return null;
    }

    const booking = await this.getBookingRepository().findOneById(objectId);

    if (!booking || booking.studentId !== studentId) {
      return null;
    }

    return this.mapBooking(booking);
  }

  public async findLibraryBookingById(
    libraryId: string,
    bookingId: string,
  ): Promise<BookingRecord | null> {
    const objectId = this.tryParseObjectId(bookingId);
    if (!objectId) {
      return null;
    }

    const booking = await this.getBookingRepository().findOneById(objectId);
    if (!booking || booking.libraryId !== libraryId) {
      return null;
    }

    return this.mapBooking(booking);
  }

  public async markBookingPaid(
    bookingId: string,
    paymentMethod?: LibraryPaymentMethod,
  ): Promise<BookingRecord | null> {
    const objectId = this.tryParseObjectId(bookingId);
    if (!objectId) {
      return null;
    }

    const bookingRepository = this.getBookingRepository();
    const setFields: Record<string, unknown> = {
      status: 'confirmed',
      updatedAt: new Date(),
    };
    if (paymentMethod) {
      setFields.paymentMethod = paymentMethod;
    }

    // eslint-disable-next-line @typescript-eslint/naming-convention
    await bookingRepository.updateOne({ _id: objectId }, { $set: setFields });

    const updated = await bookingRepository.findOneById(objectId);
    if (!updated) {
      return null;
    }

    return this.mapBooking(updated);
  }

  public async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
  ): Promise<BookingRecord | null> {
    const objectId = this.tryParseObjectId(bookingId);
    if (!objectId) {
      return null;
    }

    const bookingRepository = this.getBookingRepository();
    /* eslint-disable @typescript-eslint/naming-convention */
    await bookingRepository.updateOne(
      { _id: objectId },
      { $set: { status, updatedAt: new Date() } },
    );
    /* eslint-enable @typescript-eslint/naming-convention */

    const updated = await bookingRepository.findOneById(objectId);
    if (!updated) {
      return null;
    }

    return this.mapBooking(updated);
  }

  public async findBookingById(bookingId: string): Promise<BookingRecord | null> {
    const objectId = this.tryParseObjectId(bookingId);
    if (!objectId) {
      return null;
    }

    const booking = await this.getBookingRepository().findOneById(objectId);
    if (!booking) {
      return null;
    }

    return this.mapBooking(booking);
  }

  private async ensureIndexes(): Promise<void> {
    if (this.indexesEnsured) {
      return;
    }

    await this.createIndexSafely(
      { studentId: 1, createdAt: -1 },
      { name: 'idx_bookings_student_created_at' },
    );
    await this.createIndexSafely(
      { libraryId: 1, slotType: 1, seatId: 1, status: 1, validUntil: 1 },
      { name: 'idx_bookings_library_slot_seat_active' },
    );
    await this.createIndexSafely(
      { libraryId: 1, slotType: 1, sectionId: 1, status: 1, validUntil: 1 },
      { name: 'idx_bookings_library_slot_section_active' },
    );
    await this.createIndexSafely(
      { libraryId: 1, status: 1, updatedAt: -1 },
      { name: 'idx_bookings_library_status_updated_at' },
    );

    this.indexesEnsured = true;
  }

  private async createIndexSafely(
    keys: Record<string, 1 | -1>,
    options: { name: string; unique?: boolean },
  ): Promise<void> {
    try {
      await this.getBookingRepository().createCollectionIndex(keys, options);
    } catch (error) {
      if (this.isIgnorableIndexError(error)) {
        return;
      }

      throw error;
    }
  }

  private isIgnorableIndexError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const errWithCode = error as { code?: number; message?: string };
    const message = (errWithCode.message || '').toLowerCase();

    if (errWithCode.code === 85 || errWithCode.code === 86) {
      return true;
    }

    return (
      message.includes('already exists') ||
      message.includes('index options conflict') ||
      message.includes('index key specs conflict')
    );
  }

  private mapBooking(booking: BookingModel): BookingRecord {
    return {
      id: this.toHexString(booking),
      libraryId: booking.libraryId,
      studentId: booking.studentId,
      libraryName: booking.libraryName,
      libraryAddress: booking.libraryAddress,
      slotType: booking.slotType,
      slotName: booking.slotName,
      slotStartTime: booking.slotStartTime,
      slotEndTime: booking.slotEndTime,
      seatId: booking.seatId,
      sectionId: booking.sectionId,
      paymentMethod: booking.paymentMethod,
      amount: booking.amount,
      duration: booking.duration,
      startDate: booking.startDate,
      validUntil: booking.validUntil,
      status: booking.status,
      checkedInAt: booking.checkedInAt,
      checkedOutAt: booking.checkedOutAt,
      invoiceNo: booking.invoiceNo,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
  }

  private toHexString(value: WithObjectId): string {
    return value.id.toHexString();
  }

  private tryParseObjectId(value: string): ObjectId | null {
    if (!ObjectId.isValid(value)) {
      return null;
    }

    return new ObjectId(value);
  }

  private getBookingRepository(): MongoRepository<BookingModel> {
    return getDataSource().getMongoRepository(BookingModel);
  }
}
