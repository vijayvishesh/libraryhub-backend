import * as bcrypt from 'bcrypt';
import { HttpError, InternalServerError, NotFoundError, UnauthorizedError } from 'routing-controllers';
import { Service } from 'typedi';
import { AuthRepository } from '../repositories/auth.repositories';
import { BookingRepository } from '../repositories/booking.repository';
import { LibraryRepository } from '../repositories/library.repository';
import { LibraryTransferRepository } from '../repositories/libraryTransfer.repository';
import { MemberRepository } from '../repositories/member.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { InitiateLibraryTransferRequest, VerifyLibraryTransferOtpRequest } from '../controllers/requests/libraryTransfer.request';
import { LibraryTransferInitiateData } from '../controllers/responses/libraryTransfer.response';
import { LibraryTransferRecord } from '../repositories/types/libraryTransfer.repository.types';

const STATIC_OTP = '555555';
const OTP_EXPIRY_MINUTES = 10;
const PASSWORD_SALT_ROUNDS = 10;

@Service()
export class LibraryTransferService {
  constructor(
    private readonly libraryTransferRepository: LibraryTransferRepository,
    private readonly libraryRepository: LibraryRepository,
    private readonly authRepository: AuthRepository,
    private readonly memberRepository: MemberRepository,
    private readonly bookingRepository: BookingRepository,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  // ── API 1: Initiate transfer — owner calls this ─────────────────────────
  public async initiateTransfer(
    ownerId: string,
    payload: InitiateLibraryTransferRequest,
  ): Promise<LibraryTransferInitiateData> {
    try {
      // 1. Verify library belongs to this owner
      const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
      if (!library || library.deletedAt) {
        throw new NotFoundError('LIBRARY_NOT_FOUND');
      }
      if (library.id !== payload.library_id) {
        throw new HttpError(403, 'LIBRARY_NOT_YOURS');
      }

      // 2. Get old owner record
      const oldOwner = await this.authRepository.findOwnerById(ownerId);
      if (!oldOwner) throw new NotFoundError('OWNER_NOT_FOUND');

      // 3. Normalize new owner phone
      const newOwnerPhone = this.normalizePhone(payload.new_owner.phone);

      // 4. Prevent transfer to same owner
      if (newOwnerPhone === oldOwner.phone) {
        throw new HttpError(400, 'CANNOT_TRANSFER_TO_SAME_OWNER');
      }

      // 5. Prevent transfer if new owner phone already is an owner
      const existingOwner = await this.authRepository.findOwnerByPhone(newOwnerPhone);
      if (existingOwner) {
        throw new HttpError(409, 'NEW_OWNER_PHONE_ALREADY_REGISTERED_AS_OWNER');
      }

      // 6. Cancel any existing pending transfer for this library
      await this.libraryTransferRepository.cancelPendingByLibraryId(library.id);

      // 7. Validate library settings
      const keepName = payload.library_settings.keep_library_name;
      const newName = payload.library_settings.new_library_name;
      if (!keepName && (!newName || !newName.trim())) {
        throw new HttpError(400, 'NEW_LIBRARY_NAME_REQUIRED_WHEN_NOT_KEEPING');
      }

      // 8. Create transfer record with OTPs
      const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
      const transfer = await this.libraryTransferRepository.create({
        libraryId: library.id,
        oldOwnerId: ownerId,
        oldOwnerPhone: oldOwner.phone,
        newOwnerName: payload.new_owner.name.trim(),
        newOwnerPhone,
        newOwnerEmail: payload.new_owner.email?.trim() ?? null,
        keepLibraryName: keepName,
        newLibraryName: keepName ? null : newName!.trim(),
        notifyStudents: payload.library_settings.notify_students,
        oldOwnerOtp: STATIC_OTP,
        newOwnerOtp: STATIC_OTP,
        otpExpiresAt,
      });

      // 9. Send OTPs (placeholder — plug in WhatsApp/SMS provider)
      await this.sendOtp(oldOwner.phone, STATIC_OTP, 'old owner');
      await this.sendOtp(newOwnerPhone, STATIC_OTP, 'new owner');

      return new LibraryTransferInitiateData({
        transferId: transfer.id,
        message: 'OTPs sent to both old and new owner. Verify within 10 minutes.',
        otpSentTo: this.maskPhone(oldOwner.phone),
        newOwnerOtpSentTo: this.maskPhone(newOwnerPhone),
        expiresAt: otpExpiresAt,
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('INITIATE_TRANSFER_FAILED');
    }
  }

  // ── API 2: Verify OTPs and complete transfer ────────────────────────────
  public async verifyAndCompleteTransfer(
    ownerId: string,
    payload: VerifyLibraryTransferOtpRequest,
  ): Promise<LibraryTransferRecord> {
    try {
      // 1. Find the pending transfer
      const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
      if (!library || library.deletedAt) throw new NotFoundError('LIBRARY_NOT_FOUND');
      if (library.id !== payload.library_id) throw new HttpError(403, 'LIBRARY_NOT_YOURS');

      const transfer = await this.libraryTransferRepository.findPendingByLibraryId(library.id);
      if (!transfer) throw new NotFoundError('NO_PENDING_TRANSFER_FOUND');
      if (transfer.oldOwnerId !== ownerId) throw new HttpError(403, 'TRANSFER_NOT_YOURS');

      // 2. Check OTP expiry
      if (transfer.otpExpiresAt.getTime() < Date.now()) {
        throw new UnauthorizedError('OTP_EXPIRED');
      }

      // 3. Validate both OTPs
      if (payload.old_owner_otp.trim() !== transfer.oldOwnerOtp) {
        throw new UnauthorizedError('INVALID_OLD_OWNER_OTP');
      }
      if (payload.new_owner_otp.trim() !== transfer.newOwnerOtp) {
        throw new UnauthorizedError('INVALID_NEW_OWNER_OTP');
      }

      // 4. Hash new owner password
      const hashedPassword = await bcrypt.hash(
        transfer.newOwnerPhone + '_transfer_' + Date.now(),
        PASSWORD_SALT_ROUNDS,
      );

      // 5. Create new tenant for new owner
      const finalLibraryName = transfer.keepLibraryName
        ? library.name
        : transfer.newLibraryName!;

      const newTenant = await this.authRepository.createTenant({
        name: finalLibraryName,
        city: library.city,
        isSetupCompleted: true,
        ownerId: '',
      });

      // 6. Create new owner account
      const newOwner = await this.authRepository.createOwner({
        tenantId: newTenant.id,
        name: transfer.newOwnerName,
        phone: transfer.newOwnerPhone,
        password: hashedPassword,
        hasCreatedLibrary: true,
        role: 'OWNER',
      });

      // 7. Link tenant to new owner
      await this.authRepository.updateTenantOwnerId(newTenant.id, newOwner.id);

      // 8. Update library — new owner, remove old contact details
      const libraryUpdateInput = {
        ownerId: newOwner.id,
        name: finalLibraryName,
        contactPhone: transfer.newOwnerPhone,
        contactEmail: transfer.newOwnerEmail,
      };
      await this.libraryRepository.partialUpdateLibrary(library.id, libraryUpdateInput);

      // 9. If library name changed — update bookings libraryName
      if (!transfer.keepLibraryName && transfer.newLibraryName) {
        await this.updateBookingsLibraryName(library.id, transfer.newLibraryName);
      }

      // 10. Old owner — set hasCreatedLibrary to false so they can create a new library
      await this.authRepository.updateOwnerHasCreatedLibrary(ownerId, false);

      // 11. Revoke all active sessions for old owner
      await this.revokeOldOwnerSessions(ownerId);

      // 12. Notify students if requested
      if (transfer.notifyStudents) {
        await this.notifyStudentsOfTransfer(
          library.id,
          finalLibraryName,
          transfer.newOwnerName,
        );
      }

      // 13. Mark transfer complete
      const completed = await this.libraryTransferRepository.complete(transfer.id, newOwner.id);
      if (!completed) throw new InternalServerError('TRANSFER_COMPLETION_FAILED');

      return completed;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('VERIFY_TRANSFER_FAILED');
    }
  }

  // ── Helper: update all bookings with new library name ──────────────────
  private async updateBookingsLibraryName(
    libraryId: string,
    newLibraryName: string,
  ): Promise<void> {
    try {
      await this.bookingRepository.updateLibraryNameByLibraryId(libraryId, newLibraryName);
    } catch {
      // Non-blocking — bookings name update failure should not stop transfer
    }
  }

  // ── Helper: revoke old owner auth sessions ──────────────────────────────
  private async revokeOldOwnerSessions(ownerId: string): Promise<void> {
    try {
      // Using authRepository's getDataSource to bulk revoke
      const { getDataSource } = await import('../../database/config/ormconfig.default');
      const { AuthSessionModel } = await import('../models/authSession.model');
      const repo = getDataSource().getMongoRepository(AuthSessionModel);
      const sessions = await repo.find({
        where: { ownerId, isRevoked: false } as any,
      });
      const now = new Date();
      await Promise.all(
        sessions.map(async s => {
          s.isRevoked = true;
          s.updatedAt = now;
          await repo.save(s);
        }),
      );
    } catch {
      // Non-blocking
    }
  }

  // ── Helper: notify all active library members ───────────────────────────
  private async notifyStudentsOfTransfer(
    libraryId: string,
    newLibraryName: string,
    newOwnerName: string,
  ): Promise<void> {
    try {
      const members = await this.memberRepository.findAllMembersByLibrary(libraryId);
      const activeMembers = members.filter(m => m.status === 'active' && m.studentId);

      if (activeMembers.length === 0) return;

      await this.notificationRepository.createMany(
        activeMembers.map(m => ({
          studentId: m.studentId!,
          title: 'Library Ownership Changed',
          message: `${newLibraryName} is now managed by ${newOwnerName}. Your membership continues as usual.`,
          type: 'system' as const,
          referenceId: libraryId,
        })),
      );
    } catch {
      // Non-blocking
    }
  }

  // ── Helper: mask phone for response ────────────────────────────────────
  private maskPhone(phone: string): string {
    if (phone.length < 4) return '****';
    return phone.slice(0, 2) + '****' + phone.slice(-2);
  }

  // ── Helper: normalize phone ─────────────────────────────────────────────
  private normalizePhone(phone: string): string {
    const trimmed = phone.trim().replace(/\s+/g, '');
    if (trimmed.startsWith('+91') && trimmed.length === 13) return trimmed.slice(3);
    if (trimmed.startsWith('91') && trimmed.length === 12) return trimmed.slice(2);
    return trimmed;
  }

  // ── Helper: send OTP (placeholder) ─────────────────────────────────────
  private async sendOtp(phone: string, otp: string, recipient: string): Promise<void> {
    void phone;
    void otp;
    void recipient;
    // Plug in WhatsApp / SMS provider here
  }
}