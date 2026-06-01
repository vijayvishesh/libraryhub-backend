import { HttpError, InternalServerError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { AuthRepository } from '../repositories/auth.repositories';
import { BookingRepository } from '../repositories/booking.repository';
import { LibraryRepository } from '../repositories/library.repository';
import { MemberLeaveRequestRepository } from '../repositories/memberLeaveRequest.repository';
import { MemberRepository } from '../repositories/member.repository';
import { LeaveRequestResult } from './types/memberLeaveRequest.service.types';
import { ObjectId } from 'mongodb';
import { FcmTokenRepository } from '../repositories/fcmToken.repository';
import { NotificationRepository } from '../repositories/notification.repository';
import { ActivityService } from './activity.service';
import { getFirebaseMessaging } from '../../lib/firebase/firebase';

@Service()
export class MemberLeaveRequestService {
  constructor(
    private readonly memberRepository: MemberRepository,
    private readonly memberLeaveRequestRepository: MemberLeaveRequestRepository,
    private readonly bookingRepository: BookingRepository,
    private readonly libraryRepository: LibraryRepository,
    private readonly authRepository: AuthRepository,
    private readonly notificationRepository: NotificationRepository,   
    private readonly fcmTokenRepository: FcmTokenRepository,           
    private readonly activityService: ActivityService,                 
  ) {}

  // ── STUDENT: raise a leave request ───────────────────────────────────────

  public async raiseLeaveRequest(
    studentId: string,
    libraryId: string,
    reason?: string,
  ): Promise<LeaveRequestResult> {
    try {
          console.log('raiseLeaveRequest called with:', { studentId, libraryId });
  console.log('isValidObjectId:', ObjectId.isValid(studentId));
      // 1. Validate student exists
      const student = await this.authRepository.findStudentById(studentId);
      if (!student) throw new NotFoundError('STUDENT_NOT_FOUND');

      // 2. Find their active member record in this library
      const member = await this.memberRepository.findMemberByStudentIdAndLibrary(
        studentId,
        libraryId,
      );
      if (!member) throw new NotFoundError('MEMBER_NOT_FOUND');

      // Only active or pending members can raise a leave request
      if (member.status === 'inactive' || member.status === 'expired') {
        throw new HttpError(409, 'MEMBER_NOT_ELIGIBLE_FOR_LEAVE');
      }

      // 3. Block duplicate pending requests
      const existingPending = await this.memberLeaveRequestRepository.findPendingByMember(
        member.id,
        libraryId,
      );
      if (existingPending) {
        throw new HttpError(409, 'LEAVE_REQUEST_ALREADY_PENDING');
      }

      // 4. Create leave request
      const request = await this.memberLeaveRequestRepository.createLeaveRequest({
        memberId:  member.id,
        studentId: student.id,
        libraryId,
        bookingId: member.bookingId ?? null,
        reason:    reason?.trim() || null,
      });
           await this.notifyOwnerOfLeaveRequest(
        libraryId,
        student.name,
        request.id,
      );

      // ── Recent activity (owner's feed) ────────────────────────────────────
      const library = await this.libraryRepository.findLibraryById(libraryId);
      if (library?.ownerId) {
        await this.activityService.logActivity(
          library.ownerId,
          'LEAVE_REQUEST_RAISED',
          `${student.name} raised a leave request`,
          { studentId, libraryId, requestId: request.id },
        );
      }

      return this.mapResult(request, student.name, student.phone, member.seatId, member.slotId);
    } catch (error) {
      this.rethrow(error, 'RAISE_LEAVE_REQUEST_FAILED');
    }
  }

    private async notifyOwnerOfLeaveRequest(
    libraryId: string,
    studentName: string,
    requestId: string,
  ): Promise<void> {
    try {
      const library = await this.libraryRepository.findLibraryById(libraryId);
      if (!library?.ownerId) return;

      const title   = 'Leave Request';
      const message = `${studentName} has requested to leave the library`;

      // DB notification for owner
      await this.notificationRepository.createOwnerNotification({
        ownerId:     library.ownerId,
        title,
        message,
        type:        'leave_request',
        referenceId: requestId,
      });

      // Push notification to owner's devices
      const ownerTokens = await this.fcmTokenRepository.findByOwnerId(library.ownerId);
      const tokens = ownerTokens.map(t => t.token);
      if (tokens.length > 0) {
        const messaging = getFirebaseMessaging();
        await messaging.sendEachForMulticast({
          tokens,
          notification: { title, body: message },
          android: { priority: 'high' },
          apns:    { payload: { aps: { sound: 'default' } } },
        });
      }
    } catch (error) {
      console.error('Leave request owner notification failed:', error);
    }
  }


  // ── STUDENT: get their leave request status for a library ─────────────────

  public async getMyLeaveRequest(
    studentId: string,
    libraryId: string,
  ): Promise<LeaveRequestResult | null> {
    try {
      const requests = await this.memberLeaveRequestRepository.listByStudent(studentId);
      const forLibrary = requests.find(r => r.libraryId === libraryId && r.status === 'pending');
      if (!forLibrary) return null;

      const student = await this.authRepository.findStudentById(studentId);
      console.log('student found:', student);
      const member  = await this.memberRepository.findMemberByStudentIdAndLibrary(
        studentId,
        libraryId,
      );

      return this.mapResult(
        forLibrary,
        student?.name,
        student?.phone,
        member?.seatId,
        member?.slotId,
      );
    } catch (error) {
      this.rethrow(error, 'GET_LEAVE_REQUEST_FAILED');
    }
  }

  // ── OWNER: list all leave requests for their library ──────────────────────
private async notifyStudentOfLeaveResolution(
  studentId: string,
  status: 'approved' | 'rejected',
  requestId: string,
  rejectionReason?: string,
): Promise<void> {
  try {
    const title   = status === 'approved' ? 'Leave Approved' : 'Leave Rejected';
    const message = status === 'approved'
      ? 'Your leave request has been approved. You are no longer an active member.'
      : `Your leave request was rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`;

    // DB notification for student
    await this.notificationRepository.createMany([{
      studentId,
      title,
      message,
      type:        status === 'approved' ? 'leave_approved' : 'leave_rejected',
      referenceId: requestId,
    }]);

    // Push notification to student's devices
    const tokens = await this.fcmTokenRepository.findTokensByStudentIds([studentId]);
    if (tokens.length > 0) {
      const messaging = getFirebaseMessaging();
      await messaging.sendEachForMulticast({
        tokens,
        notification: { title, body: message },
        android: { priority: 'high' },
        apns:    { payload: { aps: { sound: 'default' } } },
      });
    }
  } catch (error) {
    console.error('Leave resolution student notification failed:', error);
  }
}
  public async listLeaveRequests(
    ownerId: string,
    status?: 'pending' | 'approved' | 'rejected',
    page = 1,
    limit = 20,
  ): Promise<{ requests: LeaveRequestResult[]; total: number; page: number; limit: number }> {
    try {
      const library = await this.libraryRepository.findLibraryByOwnerId(ownerId);
      if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');

      const result = await this.memberLeaveRequestRepository.listByLibrary({
        libraryId: library.id,
        status,
        page,
        limit,
      });

      // Batch-enrich with student and member data
      const studentIds = [...new Set(result.requests.map(r => r.studentId))];
      const memberIds  = [...new Set(result.requests.map(r => r.memberId))];

      const [studentMap, members] = await Promise.all([
        this.memberRepository.findStudentsByIds(studentIds),
        Promise.all(
          memberIds.map(mid => this.memberRepository.findMemberByIdAndLibrary(mid, library.id)),
        ),
      ]);

      const memberMap = new Map(
        members.filter(Boolean).map(m => [m!.id, m!]),
      );

      const requests = result.requests.map(r => {
        const student = studentMap.get(r.studentId);
        const member  = memberMap.get(r.memberId);
        return this.mapResult(r, student?.name, student?.phone, member?.seatId, member?.slotId);
      });

      return { requests, total: result.total, page, limit };
    } catch (error) {
      this.rethrow(error, 'LIST_LEAVE_REQUESTS_FAILED');
    }
  }

  // ── OWNER: approve a leave request ───────────────────────────────────────

  public async approveLeaveRequest(
    libraryId: string,
    requestId: string,
  ): Promise<LeaveRequestResult> {
    try {
      const library = await this.libraryRepository.findLibraryById(libraryId);
      if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');

      const request = await this.memberLeaveRequestRepository.findByIdAndLibrary(
        requestId,
        library.id,
      );
      if (!request) throw new NotFoundError('LEAVE_REQUEST_NOT_FOUND');
      if (request.status !== 'pending') {
        throw new HttpError(409, 'LEAVE_REQUEST_ALREADY_RESOLVED');
      }

      // 1. Mark request as approved
      const updated = await this.memberLeaveRequestRepository.updateRequest(request.id, {
        status:     'approved',
        resolvedAt: new Date(),
      });

      // 2. Set member status to 'inactive'
      await this.memberRepository.updateMemberByIdAndLibrary(request.memberId, library.id, {
        status:    'inactive',
        updatedAt: new Date(),
      });

      // 3. Expire the active booking so the seat is freed
      if (request.bookingId) {
        await this.bookingRepository.updateBookingStatus(request.bookingId, 'expired');
      }

      const student = await this.authRepository.findStudentById(request.studentId);
      const member  = await this.memberRepository.findMemberByIdAndLibrary(
        request.memberId,
        library.id,
      );
      await this.notifyStudentOfLeaveResolution(request.studentId, 'approved', request.id);
      return this.mapResult(
        updated!,
        student?.name,
        student?.phone,
        member?.seatId,
        member?.slotId,
      );
    } catch (error) {
      this.rethrow(error, 'APPROVE_LEAVE_REQUEST_FAILED');
    }
  }

  // ── OWNER: reject a leave request ────────────────────────────────────────

  public async rejectLeaveRequest(
    libraryId : string,
    requestId: string,
    rejectionReason?: string,
  ): Promise<LeaveRequestResult> {
    try {
      const library = await this.libraryRepository.findLibraryById(libraryId);
      if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');

      const request = await this.memberLeaveRequestRepository.findByIdAndLibrary(
        requestId,
        library.id,
      );
      if (!request) throw new NotFoundError('LEAVE_REQUEST_NOT_FOUND');
      if (request.status !== 'pending') {
        throw new HttpError(409, 'LEAVE_REQUEST_ALREADY_RESOLVED');
      }

      // Just update status — member remains active
      const updated = await this.memberLeaveRequestRepository.updateRequest(request.id, {
        status:          'rejected',
        rejectionReason: rejectionReason?.trim() || null,
        resolvedAt:      new Date(),
      });

      const student = await this.authRepository.findStudentById(request.studentId);
      const member  = await this.memberRepository.findMemberByStudentIdAndLibrary(
        request.studentId,
        library.id,
      );

      await this.notifyStudentOfLeaveResolution(
        request.studentId,
        'rejected',
        request.id,
        rejectionReason,
      );
      return this.mapResult(
        updated!,
        student?.name,
        student?.phone,
        member?.seatId,
        member?.slotId,
      );
    } catch (error) {
      this.rethrow(error, 'REJECT_LEAVE_REQUEST_FAILED');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private mapResult(
    request: {
      id: string;
      memberId: string;
      studentId: string;
      libraryId: string;
      bookingId: string | null;
      reason: string | null;
      status: 'pending' | 'approved' | 'rejected';
      rejectionReason: string | null;
      resolvedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    studentName?: string,
    studentPhone?: string,
    seatId?: string | null,
    slotId?: string | null,
  ): LeaveRequestResult {
    return {
      id:              request.id,
      memberId:        request.memberId,
      studentId:       request.studentId,
      libraryId:       request.libraryId,
      bookingId:       request.bookingId,
      reason:          request.reason,
      status:          request.status,
      rejectionReason: request.rejectionReason,
      resolvedAt:      request.resolvedAt,
      studentName:     studentName,
      studentPhone:    studentPhone,
      seatId:          seatId ?? null,
      slotId:          slotId ?? null,
      createdAt:       request.createdAt,
      updatedAt:       request.updatedAt,
    };
  }

  private rethrow(error: unknown, defaultMessage: string): never {
    if (error instanceof HttpError) throw error;
    throw new InternalServerError(defaultMessage);
  }
}