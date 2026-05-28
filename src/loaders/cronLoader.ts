import { MicroframeworkLoader } from 'microframework-w3tec';
import * as cron from 'node-cron';
import { AttendanceModel } from '../api/models/attendance.model';
import { BookingModel } from '../api/models/booking.model';
import { FcmTokenModel } from '../api/models/fcmToken.model';
import { LibraryModel } from '../api/models/library.model';
import { MemberModel } from '../api/models/member.model';
import { NotificationModel, NotificationType } from '../api/models/notification.model';
import { StudySessionModel } from '../api/models/studySession.model';
import {
  StudyTimetableModel,
  TimetableDay,
  TimetableSubject,
} from '../api/models/studyTimetable.model';
import { getDataSource } from '../database/config/ormconfig.default';
import { getFirebaseMessaging } from '../lib/firebase/firebase';
import { Logger } from '../lib/logger';
import redisCache from '../lib/redis/db.redis';
import { ObjectId } from 'mongodb';
import { AnnouncementModel, AnnouncementTarget } from '../api/models/announcement.model';

const log = new Logger(__filename);

const LOCK_KEY = 'cron:member-expiry:lock';
const LOCK_TTL_SECONDS = 3600;

// ── Shared helpers ────────────────────────────────────────────────────────────

const DEAD_TOKEN_CODES = [
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/third-party-auth-error',
  'messaging/invalid-argument',
];

async function sendFcmToStudents(
  studentIds: string[],
  title: string,
  body: string,
): Promise<void> {
  if (studentIds.length === 0) return;
  try {
    const fcmRepo = getDataSource().getMongoRepository(FcmTokenModel);
    const tokenDocs = await fcmRepo.find({
      where: { studentId: { $in: studentIds } } as any,
    });
    const tokens = tokenDocs.map(t => t.token).filter(Boolean);
    if (tokens.length === 0) return;

    const messaging = getFirebaseMessaging();
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      // Auto-delete dead tokens
      if (response.failureCount > 0) {
        const toDelete: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success && DEAD_TOKEN_CODES.includes(resp.error?.code ?? '')) {
            toDelete.push(batch[idx]);
          }
        });
        if (toDelete.length > 0) {
          await fcmRepo.deleteMany({ token: { $in: toDelete } } as any);
        }
      }
    }
  } catch {
    // non-critical
  }
}

// Keep single-student variant for backward compat (revision, timetable)
async function sendFcmToStudent(studentId: string, title: string, body: string): Promise<void> {
  return sendFcmToStudents([studentId], title, body);
}

async function sendFcmToOwners(
  ownerIds: string[],
  title: string,
  body: string,
): Promise<void> {
  if (ownerIds.length === 0) return;
  try {
    const fcmRepo = getDataSource().getMongoRepository(FcmTokenModel);

    // ✅ FIXED — fetch all tokens and filter in JS (same fix as studentId $in bug)
    const allTokenDocs = await fcmRepo.find({});
    const tokenDocs = allTokenDocs.filter(t => t.ownerId && ownerIds.includes(t.ownerId));
    const tokens = tokenDocs.map(t => t.token).filter(Boolean);

    console.log('🔔 Owner tokens found:', tokens.length);
    if (tokens.length === 0) return;

    const messaging = getFirebaseMessaging();
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      console.log('🔔 FCM owner result:', JSON.stringify(response.responses.map((r, idx) => ({
        token: batch[idx].slice(0, 20),
        success: r.success,
        error: r.error?.code,
      }))));

      if (response.failureCount > 0) {
        const toDelete: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success && DEAD_TOKEN_CODES.includes(resp.error?.code ?? '')) {
            toDelete.push(batch[idx]);
          }
        });
        if (toDelete.length > 0) {
          await fcmRepo.deleteMany({ token: { $in: toDelete } } as any);
        }
      }
    }
  } catch (err) {
    console.error('❌ sendFcmToOwners failed:', err);
  }
}

// Replace existing saveInAppNotifications
async function saveInAppNotifications(
  studentIds: string[],
  title: string,
  message: string,
  type: NotificationType,
  referenceId: string,
): Promise<void> {
  if (studentIds.length === 0) return;
  try {
    const notifRepo = getDataSource().getMongoRepository(NotificationModel);
    const now = new Date();
    const docs = studentIds.map(studentId =>
      notifRepo.create({
        studentId,
        ownerId: null,         // ← add this
        title,
        message,
        type,
        referenceId,
        isRead: false,
        createdAt: now,
        updatedAt: now,
      }),
    );
    await notifRepo.save(docs);
  } catch {
    // non-critical
  }
}

async function saveOwnerNotification(
  ownerId: string,
  title: string,
  message: string,
  type: NotificationType,
  referenceId: string,
): Promise<void> {
  try {
    const notifRepo = getDataSource().getMongoRepository(NotificationModel);
    const now = new Date();
    await notifRepo.save(
      notifRepo.create({
        studentId: null,
        ownerId,
        title,
        message,
        type,
        referenceId,
        isRead: false,
        createdAt: now,
        updatedAt: now,
      }),
    );
  } catch {
    // non-critical
  }
}

// Keep single-student variant for backward compat
async function saveInAppNotification(
  studentId: string,
  title: string,
  message: string,
  type: NotificationType,
  referenceId: string,
): Promise<void> {
  return saveInAppNotifications([studentId], title, message, type, referenceId);
}

// Returns "HH:mm" for now + offsetMinutes
function hhmm(date: Date, offsetMinutes = 0): string {
  const d = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Member expiry job (unchanged) ─────────────────────────────────────────────

export async function runMemberExpiryJob(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const memberRepo = getDataSource().getMongoRepository(MemberModel);
  const libraryRepo = getDataSource().getMongoRepository(LibraryModel);

  // Find before updating so we have member details
  const toExpire = await memberRepo.find({
    where: { status: 'active', endDate: { $lt: today } } as any,
  });

  if (toExpire.length === 0) return 0;

  const result = await memberRepo.updateMany(
    { status: 'active', endDate: { $lt: today } },
    { $set: { status: 'expired', paidAt: null, updatedAt: new Date() } },
  );

  if (result.modifiedCount > 0) {
    log.info(`Cron: Expired ${result.modifiedCount} members`);

    // Notify each library owner
    // Group by libraryId to avoid N+1 library lookups
    const byLibrary = new Map<string, typeof toExpire>();
    for (const m of toExpire) {
      const list = byLibrary.get(m.libraryId) ?? [];
      list.push(m);
      byLibrary.set(m.libraryId, list);
    }

    for (const [libraryId, members] of byLibrary) {
      try {
        const library = await libraryRepo.findOne({
          where: { _id: libraryId } as any,
        });
        if (!library) continue;

        for (const member of members) {
          await sendOwnerMemberExpiredNotification(
            library.ownerId,
            member.fullName,
            library.name,
            (member.id || (member as any)._id).toHexString(),
          );
        }
      } catch {
        // non-critical
      }
    }
  }

  return result.modifiedCount;
}

// ── Revision reminders (unchanged) ───────────────────────────────────────────

export async function runRevisionReminderJob(): Promise<void> {
  const now = new Date();
  const sessionRepo = getDataSource().getMongoRepository(StudySessionModel);

  const due = await sessionRepo.find({
    where: {
      deletedAt: null,
      reminderSent: { $ne: true },
      revisionReminderDate: { $ne: null, $lte: now },
    } as any,
  });

  for (const session of due) {
    const sessionId = (session.id || (session as any)._id).toHexString();
    try {
      const dateStr = new Date(session.createdAt).toLocaleDateString();
      const title = 'Revision Reminder';
      const body = `Time to revise your study session notes from ${dateStr}!`;
      await sendFcmToStudent(session.studentId, title, body);
      await saveInAppNotification(session.studentId, title, body, 'revision_reminder', sessionId);
      const fresh = await sessionRepo.findOneById(session.id || (session as any)._id);
      if (fresh) {
        fresh.reminderSent = true;
        fresh.updatedAt = new Date();
        await sessionRepo.save(fresh);
      }
    } catch {
      log.warn(`Cron: Revision reminder failed for session ${sessionId}`);
    }
  }

  if (due.length > 0) {
    log.info(`Cron: Sent ${due.length} revision reminder(s)`);
  }
}

export async function sendStudentBookingStatusPush(
  studentId: string,
  status: 'approved' | 'rejected',
  libraryName: string,
  bookingId: string,
): Promise<void> {
  const isApproved = status === 'approved';
  const title = isApproved ? '✅ Booking Approved!' : '❌ Booking Rejected';
  const body = isApproved
    ? `Your membership at ${libraryName} has been approved. Welcome!`
    : `Your membership at ${libraryName} was not approved. Contact the library for details.`;

  await sendFcmToStudents([studentId], title, body);
  await saveInAppNotifications([studentId], title, body,
    isApproved ? 'booking_approved' : 'booking_rejected',
    bookingId,
  );
}

// ── Timetable reminders (unchanged logic, updated notification type) ──────────

const timetableReminderSentCache = new Map<string, number>();

const WEEKDAY_NAMES: TimetableDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export async function runTimetableReminderJob(): Promise<void> {
  const now = new Date();
  const todayName = WEEKDAY_NAMES[now.getDay()];
  const todayDate = now.toISOString().slice(0, 10);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const timetableRepo = getDataSource().getMongoRepository(StudyTimetableModel);
  const activeTimetables = await timetableRepo.find({
    where: { isActive: true, deletedAt: null } as any,
  });

  const staleBefore = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, ts] of timetableReminderSentCache) {
    if (ts < staleBefore) timetableReminderSentCache.delete(key);
  }

  for (const timetable of activeTimetables) {
    const timetableId = (timetable.id || (timetable as any)._id).toHexString();
    const subjects: TimetableSubject[] = timetable.subjects ?? [];

    for (let idx = 0; idx < subjects.length; idx++) {
      const subject = subjects[idx];
      if (!subject.reminder?.enabled || !subject.reminder.minutesBefore) continue;
      if (!subject.days.includes(todayName)) continue;

      const [startHour, startMin] = subject.startTime.split(':').map(Number);
      const fireAtMinutes = startHour * 60 + startMin - subject.reminder.minutesBefore;
      if (Math.abs(currentMinutes - fireAtMinutes) > 1) continue;

      const inProcessKey = `${timetableId}:${idx}:${todayDate}`;
      const redisKey = `timetable:reminder:${timetableId}:${idx}:${todayDate}`;

      try {
        const alreadySent = await redisCache.get<string>(redisKey);
        if (alreadySent) continue;
        await redisCache.set(redisKey, '1', 7200);
      } catch {
        if (timetableReminderSentCache.has(inProcessKey)) continue;
      }

      timetableReminderSentCache.set(inProcessKey, Date.now());

      const title = `Study Reminder: ${subject.subjectName}`;
      const body = `Your ${subject.subjectName} session starts in ${subject.reminder.minutesBefore} min (${subject.startTime})`;
      await sendFcmToStudent(timetable.studentId, title, body);
      await saveInAppNotification(
        timetable.studentId, title, body, 'timetable_reminder', timetableId,
      );
    }
  }
}


export async function runAutoCheckoutJob(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const attendanceRepo = getDataSource().getMongoRepository(AttendanceModel);
  const bookingRepo    = getDataSource().getMongoRepository(BookingModel);

  const checkedIn = await attendanceRepo.find({
    where: {
      status: 'checked_in',
      $or: [
        { date: { $lt: today } },                                                    // normal slots from previous days
        { checkInTime: { $lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },   // 24hr slots where 24hrs have passed
      ],
    } as any,
  });

  let count = 0;

  for (const record of checkedIn) {
    try {
      const recordId = record.id ?? (record as any)._id;

      const booking = await bookingRepo.findOne({
        where: {
          studentId: record.studentId,
          libraryId: record.libraryId,
          status:    'confirmed',
        } as any,
        order: { createdAt: 'DESC' } as any,
      });

      let checkOutTime: Date;

      const is24HourSlot = booking?.slotType === 'twentyfour';

      if (is24HourSlot && record.checkInTime) {
        // ✅ 24hr slot — checkout exactly 24 hours after check-in
        const checkInDate = new Date(record.checkInTime);
        checkOutTime = new Date(checkInDate.getTime() + 24 * 60 * 60 * 1000);
      } else if (booking?.slotEndTime) {
        // ✅ Normal slot — checkout at slot end time on the same day
        const [hour, minute] = (booking.slotEndTime as string).split(':').map(Number);
        const hh = String(hour).padStart(2, '0');
        const mm = String(minute).padStart(2, '0');
        checkOutTime = new Date(`${record.date}T${hh}:${mm}:00`);
      } else {
        // ⚠️ No booking info found — fallback to end of day
        checkOutTime = new Date(`${record.date}T23:59:59`);
      }

      const result = await attendanceRepo.updateOne(
        { _id: recordId } as any,
        {
          $set: {
            checkOutTime,
            status:    'checked_out',
            updatedAt: new Date(),
          },
        },
      );

      if (result.modifiedCount > 0) {
        count++;
      } else {
        // ✅ fallback — fetch and save manually
        const fresh = await attendanceRepo.findOneById(recordId);
        if (fresh) {
          (fresh as any).checkOutTime = checkOutTime;
          (fresh as any).status       = 'checked_out';
          (fresh as any).updatedAt    = new Date();
          await attendanceRepo.save(fresh);
          count++;
        }
      }
    } catch (err) {
      log.warn(`Cron: Auto-checkout failed for ${record.studentId}/${record.libraryId}/${record.date}: ${err}`);
    }
  }

  if (count > 0) {
    log.info(`Cron: Auto-checked-out ${count} attendance record(s)`);
  }
}

// ── NEW: Slot starting in 10 min ──────────────────────────────────────────────

export async function runSlotStartingReminderJob(): Promise<void> {
  try {
    const now = new Date();
    const targetTime = hhmm(now, 10); // slots starting in exactly 10 min

    const libraryRepo = getDataSource().getMongoRepository(LibraryModel);
    const memberRepo = getDataSource().getMongoRepository(MemberModel);

    const libraries = await libraryRepo.find({
      where: { isActive: true, deletedAt: null } as any,
    });

    for (const library of libraries) {
      const libraryId = (library.id || (library as any)._id).toHexString();

      const matchingSlots = (library.slots ?? []).filter(
        s => s.isActive && s.startTime === targetTime,
      );
      if (matchingSlots.length === 0) continue;

      for (const slot of matchingSlots) {
        const members = await memberRepo.find({
          where: {
            libraryId,
            slotId: slot.slotType,
            status: 'active',
            studentId: { $ne: null },
          } as any,
        });

        const studentIds = [...new Set(members.map(m => m.studentId as string))];
        if (studentIds.length === 0) continue;

        const title = '⏰ Slot Starting in 10 Minutes';
        const body = `Your ${slot.name} slot at ${library.name} starts at ${slot.startTime}. Get ready!`;

        await sendFcmToStudents(studentIds, title, body);
        await saveInAppNotifications(studentIds, title, body, 'slot_starting', libraryId);
      }
    }
  } catch (err) {
    log.error('Cron: runSlotStartingReminderJob failed', [err]);
  }
}

// ── NEW: Not checked in 15 min after slot start ───────────────────────────────

export async function runNotCheckedInReminderJob(): Promise<void> {
  try {
    const now = new Date();
    const targetTime = hhmm(now, -15); // slots that started exactly 15 min ago
    const today = now.toISOString().slice(0, 10);

    const libraryRepo = getDataSource().getMongoRepository(LibraryModel);
    const memberRepo = getDataSource().getMongoRepository(MemberModel);
    const attendanceRepo = getDataSource().getMongoRepository(AttendanceModel);

    const libraries = await libraryRepo.find({
      where: { isActive: true, deletedAt: null } as any,
    });

    for (const library of libraries) {
      const libraryId = (library.id || (library as any)._id).toHexString();

      const matchingSlots = (library.slots ?? []).filter(
        s => s.isActive && s.startTime === targetTime,
      );
      if (matchingSlots.length === 0) continue;

      // Get all check-ins today for this library
      const todayAttendance = await attendanceRepo.find({
        where: {
          libraryId,
          date: today,
          status: { $in: ['checked_in', 'on_break'] },
        } as any,
      });
      const presentIds = new Set(todayAttendance.map(a => a.studentId));

      for (const slot of matchingSlots) {
        const members = await memberRepo.find({
          where: {
            libraryId,
            slotId: slot.slotType,
            status: 'active',
            studentId: { $ne: null },
          } as any,
        });

        // Only students who have NOT checked in
        const studentIds = [
          ...new Set(
            members
              .map(m => m.studentId as string)
              .filter(id => !presentIds.has(id)),
          ),
        ];
        if (studentIds.length === 0) continue;

        const title = '📍 You Haven\'t Checked In Yet';
        const body = `Your ${slot.name} slot at ${library.name} started 15 minutes ago. Check in now!`;

        await sendFcmToStudents(studentIds, title, body);
        await saveInAppNotifications(studentIds, title, body, 'slot_not_checked_in', libraryId);
      }
    }
  } catch (err) {
    log.error('Cron: runNotCheckedInReminderJob failed', [err]);
  }
}

// ── NEW: Session expiry reminders (1 day + 3 days before endDate) ─────────────

export async function runSessionExpiryReminderJob(): Promise<void> {
  try {
    const memberRepo = getDataSource().getMongoRepository(MemberModel);
    const libraryRepo = getDataSource().getMongoRepository(LibraryModel);

    for (const daysAhead of [1, 3]) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);
      const targetDateStr = targetDate.toISOString().slice(0, 10);

      const expiringMembers = await memberRepo.find({
        where: {
          status: 'active',
          endDate: targetDateStr,
          studentId: { $ne: null },
        } as any,
      });

      if (expiringMembers.length === 0) continue;

      // Group by libraryId so we can use the library name in the message
      const byLibrary = new Map<string, typeof expiringMembers>();
      for (const m of expiringMembers) {
        const existing = byLibrary.get(m.libraryId) ?? [];
        existing.push(m);
        byLibrary.set(m.libraryId, existing);
      }

      for (const [libraryId, members] of byLibrary) {
        const library = await libraryRepo.findOne({
          where: { _id: libraryId } as any,
        });
        const libraryName = library?.name ?? 'your library';

        const studentIds = [...new Set(members.map(m => m.studentId as string))];

        const title = daysAhead === 1
          ? '⏳ Membership Expires Tomorrow!'
          : `📅 Membership Expires in ${daysAhead} Days`;
        const body = daysAhead === 1
          ? `Your membership at ${libraryName} expires tomorrow. Renew now to keep your seat!`
          : `Your membership at ${libraryName} expires in ${daysAhead} days. Renew soon!`;

        await sendFcmToStudents(studentIds, title, body);
        await saveInAppNotifications(studentIds, title, body, 'session_expiry', libraryId);
      }

      log.info(`Cron: Session expiry reminders sent for ${daysAhead} day(s) ahead`);
    }
  } catch (err) {
    log.error('Cron: runSessionExpiryReminderJob failed', [err]);
  }
}

// ── NEW: Fee due reminders ────────────────────────────────────────────────────

export async function runFeeDueReminderJob(): Promise<void> {
  try {
    const memberRepo = getDataSource().getMongoRepository(MemberModel);
    const libraryRepo = getDataSource().getMongoRepository(LibraryModel);

    const pendingMembers = await memberRepo.find({
      where: {
        status: 'pending',
        studentId: { $ne: null },
      } as any,
    });

    if (pendingMembers.length === 0) return;

    // Group by libraryId
    const byLibrary = new Map<string, typeof pendingMembers>();
    for (const m of pendingMembers) {
      const existing = byLibrary.get(m.libraryId) ?? [];
      existing.push(m);
      byLibrary.set(m.libraryId, existing);
    }

    for (const [libraryId, members] of byLibrary) {
      const library = await libraryRepo.findOne({
        where: { _id: libraryId } as any,
      });
      const libraryName = library?.name ?? 'your library';

      const studentIds = [...new Set(members.map(m => m.studentId as string))];

      const title = '💳 Fee Payment Due';
      const body = `Your fee payment is pending at ${libraryName}. Pay now to avoid suspension.`;

      await sendFcmToStudents(studentIds, title, body);
      await saveInAppNotifications(studentIds, title, body, 'fee_due', libraryId);
    }

    log.info(`Cron: Fee due reminders sent to ${pendingMembers.length} member(s)`);
  } catch (err) {
    log.error('Cron: runFeeDueReminderJob failed', [err]);
  }
}

// ── NEW: Owner push — called from BookingService directly (not a cron) ────────
// Export so BookingService can import and call it on booking create/approve/reject

export async function sendOwnerBookingRequestPush(
  ownerId: string,
  studentName: string,
  libraryName: string,
  bookingId: string,   // ← add this param
): Promise<void> {
  const title = '🔔 New Membership Request';
  const body = `${studentName} has requested to join ${libraryName}. Tap to review.`;
  await sendFcmToOwners([ownerId], title, body);
  await saveOwnerNotification(ownerId, title, body, 'booking_request', bookingId);
}

// Add this new export for member expiry owner notifications
// Called from runMemberExpiryJob when members are expired
export async function sendOwnerMemberExpiredNotification(
  ownerId: string,
  memberName: string,
  libraryName: string,
  memberId: string,
): Promise<void> {
  const title = '⚠️ Member Subscription Expired';
  const body = `${memberName}'s subscription at ${libraryName} has expired.`;
  await sendFcmToOwners([ownerId], title, body);
  await saveOwnerNotification(ownerId, title, body, 'member_expired', memberId);
}

// ── Cron loader ───────────────────────────────────────────────────────────────

export const cronLoader: MicroframeworkLoader = () => {
  // ── Existing: member expiry (every 12 hours with Redis lock) ──────────────
  cron.schedule('0 0,12 * * *', async () => {
    let lockAcquired = false;
    try {
      const acquired = await redisCache.setNX(LOCK_KEY, '1', LOCK_TTL_SECONDS);
      if (acquired) {
        lockAcquired = true;
      } else {
        try {
          await redisCache.get<string>(LOCK_KEY);
          log.info('[Cron] member-expiry lock held by another instance, skipping');
          return;
        } catch {
          log.warn('[Cron] Redis lock unavailable, running member-expiry without lock');
        }
      }
    } catch (lockErr: any) {
      log.warn('[Cron] Redis lock check failed, running without lock:', lockErr?.message);
    }

    try {
      await runMemberExpiryJob();
    } catch (error) {
      log.error('Cron: Member expiry job failed', [error]);
    } finally {
      if (lockAcquired) {
        try {
          await redisCache.delete(LOCK_KEY);
        } catch { /* ignore */ }
      }
    }
  });

  // ── Existing: revision reminders (every 30 min) ───────────────────────────
  cron.schedule('*/30 * * * *', async () => {
    try {
      await runRevisionReminderJob();
    } catch (error) {
      log.error('Cron: Revision reminder job failed', [error]);
    }
  });


  // ── Existing: midnight auto-checkout ──────────────────────────────────────
  cron.schedule('0 0 * * *', async () => {
    try {
      await runAutoCheckoutJob();
    } catch (error) {
      log.error('Cron: Auto-checkout job failed', [error]);
    }
  });

  // ── NEW: session expiry + fee due (daily 9AM) ─────────────────────────────
  cron.schedule('0 9 * * *', async () => {
    await Promise.allSettled([
      runSessionExpiryReminderJob().catch(err =>
        log.error('Cron: Session expiry reminder job failed', [err]),
      ),
      runFeeDueReminderJob().catch(err =>
        log.error('Cron: Fee due reminder job failed', [err]),
      ),
    ]);
  });

  log.info('Cron jobs loaded');
};

export async function sendOwnerInviteSubmissionPush(
  ownerId: string,
  studentName: string,
  libraryName: string,
  submissionId: string,
): Promise<void> {
  const title = '📋 New Join Request';
  const body = `${studentName} has submitted a join request for ${libraryName}. Tap to review.`;
  await sendFcmToOwners([ownerId], title, body);
  await saveOwnerNotification(ownerId, title, body, 'booking_request', submissionId);
}

// ── RENEWAL: Student sends renewal request → notify owner ────────────────────
export async function sendOwnerRenewalRequestPush(
  ownerId:          string,
  studentName:      string,
  libraryName:      string,
  memberId:         string,
  paymentMethod:    string,
  screenshotUrl?:   string | null,
): Promise<void> {
  const hasScreenshot = !!screenshotUrl;
  const title = '🔄 Renewal Request Received';
  const body  = hasScreenshot
    ? `${studentName} has requested renewal at ${libraryName} with QR payment. Screenshot attached.`
    : `${studentName} has requested renewal at ${libraryName} via ${paymentMethod}.`;

  await sendFcmToOwners([ownerId], title, body);
  await saveOwnerNotification(
    ownerId,
    title,
    // ✅ attach screenshot url in message if QR payment
    hasScreenshot ? `${body} Screenshot: ${screenshotUrl}` : body,
    'renewal_request',
    memberId,
  );
}

// ── RENEWAL: Owner approves renewal → notify student ────────────────────────
export async function sendStudentRenewalApprovedPush(
  studentId:   string,
  libraryName: string,
  endDate:     string,
  bookingId:   string,
): Promise<void> {
  const title = '✅ Renewal Approved!';
  const body  = `Your membership renewal at ${libraryName} has been approved. Valid until ${endDate}.`;
  await sendFcmToStudents([studentId], title, body);
  await saveInAppNotification(studentId, title, body, 'renewal_approved', bookingId);
}

// ── RENEWAL: Owner rejects renewal → notify student ──────────────────────────
export async function sendStudentRenewalRejectedPush(
  studentId:   string,
  libraryName: string,
  bookingId:   string,
): Promise<void> {
  const title = '❌ Renewal Rejected';
  const body  = `Your renewal request at ${libraryName} was not approved. Contact the library.`;
  await sendFcmToStudents([studentId], title, body);
  await saveInAppNotification(studentId, title, body, 'renewal_rejected', bookingId);
}

// ── PAYMENT: Owner marks payment received → notify student ───────────────────
export async function sendStudentPaymentReceivedPush(
  studentId:   string,
  libraryName: string,
  amount:      number,
  memberId:    string,
): Promise<void> {
  const title = '💰 Payment Received';
  const body  = `Your payment of ₹${amount} at ${libraryName} has been received. Thank you!`;
  await sendFcmToStudents([studentId], title, body);
  await saveInAppNotification(studentId, title, body, 'payment_received', memberId);
}

// ── PAYMENT SCREENSHOT: Student uploads QR screenshot → notify owner ─────────
export async function sendOwnerPaymentScreenshotPush(
  ownerId:       string,
  studentName:   string,
  libraryName:   string,
  screenshotUrl: string,
  memberId:      string,
): Promise<void> {
  const title = '📸 Payment Screenshot Received';
  const body  = `${studentName} has uploaded a payment screenshot for ${libraryName}. Screenshot: ${screenshotUrl}`;
  await sendFcmToOwners([ownerId], title, body);
  await saveOwnerNotification(ownerId, title, body, 'payment_screenshot', memberId);
}

// ── SUBSCRIPTION: Library subscription expiring → notify owner ───────────────
export async function sendOwnerSubscriptionExpiringPush(
  ownerId:      string,
  libraryName:  string,
  daysLeft:     number,
  libraryId:    string,
): Promise<void> {
  const title = '⚠️ Subscription Expiring Soon';
  const body  = `Your ${libraryName} subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to keep access.`;
  await sendFcmToOwners([ownerId], title, body);
  await saveOwnerNotification(ownerId, title, body, 'subscription_expiring', libraryId);
}

// ── NEW: Subscription expiry reminder (daily 10AM) ────────────────────────────
// export async function runSubscriptionExpiryReminderJob(): Promise<void> {
//   try {
//     const librarySubscriptionRepo = getDataSource().getMongoRepository(
//       (await import('../api/models/librarySubscription.model')).LibrarySubscriptionModel,
//     );
//     const libraryRepo = getDataSource().getMongoRepository(LibraryModel);

//     for (const daysAhead of [1, 3, 7]) {
//       const targetDate = new Date();
//       targetDate.setDate(targetDate.getDate() + daysAhead);
//       const targetDateStr = targetDate.toISOString().slice(0, 10);

//       const expiring = await librarySubscriptionRepo.find({
//         where: {
//           status:  'active',
//           endDate: targetDateStr,
//         } as any,
//       });

//       for (const sub of expiring) {
//         try {
//           const library = await libraryRepo.findOne({
//             where: { _id: sub.libraryId } as any,
//           });
//           if (!library) continue;

//           await sendOwnerSubscriptionExpiringPush(
//             library.ownerId,
//             library.name,
//             daysAhead,
//             sub.libraryId,
//           );
//         } catch {
//           // non-critical
//         }
//       }
//     }

//     log.info('Cron: Subscription expiry reminders sent');
//   } catch (err) {
//     log.error('Cron: runSubscriptionExpiryReminderJob failed', [err]);
//   }
// }
 export async function runSubscriptionExpiryReminderJob(): Promise<void> {
  try {
    const memberRepo   = getDataSource().getMongoRepository(MemberModel);
    const libraryRepo  = getDataSource().getMongoRepository(LibraryModel);

    for (const daysAhead of [1, 3, 7]) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);
      const targetDateStr = targetDate.toISOString().slice(0, 10); // e.g., "2026-05-28"

      // ✅ Find all active members whose membership ends on this exact date
      const expiringMembers = await memberRepo.find({
        where: {
          status:  'active',
          endDate: targetDateStr,
          studentId: { $ne: null }, // only members with app accounts
        } as any,
      });

      if (expiringMembers.length === 0) continue;

      // Group members by libraryId to avoid fetching same library multiple times
      const libraryMap = new Map<string, typeof expiringMembers[0] & { libraryName?: string }>();

      for (const member of expiringMembers) {
        try {
          // Fetch library name (cache it to avoid duplicate DB calls)
          let libraryName: string;
          if (libraryMap.has(member.libraryId)) {
            libraryName = (libraryMap.get(member.libraryId) as any).libraryName;
          } else {
            const library = await libraryRepo.findOne({
              where: { _id: new ObjectId(member.libraryId) } as any,
            });
            if (!library) continue;
            libraryName = library.name;
            (libraryMap as any).set(member.libraryId, { libraryName });
          }

          const title = '📅 Membership Expiring Soon';
          const body  = `Your membership at ${libraryName} is expiring on ${member.endDate}. Renew now to keep your seat!`;

          // ✅ Send push notification to student
          await sendFcmToStudents([member.studentId as string], title, body);

          // ✅ Save in-app notification
          await saveInAppNotifications(
            [member.studentId as string],
            title,
            body,
            'member_expired',
            member.libraryId,
          );
        } catch {
          // non-critical — skip this member, continue others
        }
      }
    }

    log.info('Cron: Membership expiry reminders sent to students');
  } catch (err) {
    log.error('Cron: runSubscriptionExpiryReminderJob failed', [err]);
  }
}

// ── CHECK-IN REMINDER (10 min before + 30 min after slot start) ──────────────
// Runs every minute via the existing '* * * * *' cron
export async function runCheckinReminderJob(): Promise<void> {
  try {
    const now = new Date();
    const libraryRepo    = getDataSource().getMongoRepository(LibraryModel);
    const memberRepo     = getDataSource().getMongoRepository(MemberModel);
    const attendanceRepo = getDataSource().getMongoRepository(AttendanceModel);

    const today      = now.toISOString().slice(0, 10);
    const minus10    = hhmm(now, -10);  // 10 min before now  → slot starting in 10 min
    const minus30    = hhmm(now, -30);  // 30 min before now  → slot started 30 min a/go

    // const isReminder10 = true;          // always check 10-min window
    // const isReminder30 = true;          // always check 30-min window

    const libraries = await libraryRepo.find({
      where: { isActive: true, deletedAt: null } as any,
    });

    for (const library of libraries) {
      const libraryId = (library.id || (library as any)._id).toHexString();

      // Get today's check-ins for this library
      const todayAttendance = await attendanceRepo.find({
        where: {
          libraryId,
          date: today,
          status: { $in: ['checked_in', 'on_break'] },
        } as any,
      });
      const checkedInIds = new Set(todayAttendance.map(a => a.studentId));

      for (const slot of (library.slots ?? [])) {
        if (!slot.isActive) continue;

        // ── 10 min BEFORE slot start ─────────────────────────────────────────
        if (slot.startTime === minus10) {
          const members = await memberRepo.find({
            where: {
              libraryId,
              slotId:    slot.slotType,
              status:    'active',
              studentId: { $ne: null },
            } as any,
          });

          const studentIds = [
            ...new Set(
              members
                .map(m => m.studentId as string)
                .filter(id => !checkedInIds.has(id)), // not yet checked in
            ),
          ];

          if (studentIds.length > 0) {
            const title = '⏰ Check-in Reminder';
            const body  = `Your ${slot.name} slot at ${library.name} starts in 10 minutes. Don't forget to check in!`;
            await sendFcmToStudents(studentIds, title, body);
            await saveInAppNotifications(studentIds, title, body, 'checkin_reminder', libraryId);
          }
        }

        // ── 30 min AFTER slot start ──────────────────────────────────────────
        if (slot.startTime === minus30) {
          const members = await memberRepo.find({
            where: {
              libraryId,
              slotId:    slot.slotType,
              status:    'active',
              studentId: { $ne: null },
            } as any,
          });

          // Only those who STILL haven't checked in after 30 min
          const studentIds = [
            ...new Set(
              members
                .map(m => m.studentId as string)
                .filter(id => !checkedInIds.has(id)),
            ),
          ];

          if (studentIds.length > 0) {
            const title = '📍 Still Not Checked In?';
            const body  = `Your ${slot.name} slot at ${library.name} started 30 minutes ago. Check in now before you're marked absent!`;
            await sendFcmToStudents(studentIds, title, body);
            await saveInAppNotifications(studentIds, title, body, 'checkin_reminder', libraryId);
          }
        }
      }
    }
  } catch (err) {
    log.error('Cron: runCheckinReminderJob failed', [err]);
  }
}

// ── ANNOUNCEMENT NOTIFICATION ─────────────────────────────────────────────────
// Called directly when owner creates/sends an announcement (not a cron)
export async function sendAnnouncementNotification(
  announcementId: string,
  libraryId:      string,
  title:          string,
  message:        string,
  target:         AnnouncementTarget,
  memberIds?:     string[], // ← for owner-selected specific members
): Promise<void> {
  try {
    const memberRepo  = getDataSource().getMongoRepository(MemberModel);
    const today       = new Date().toISOString().slice(0, 10);
    const attendanceRepo = getDataSource().getMongoRepository(AttendanceModel);

    let members: MemberModel[] = [];

    if (memberIds && memberIds.length > 0) {
      // ── Owner selected specific members ─────────────────────────────────
      members = await memberRepo.find({
        where: {
          libraryId,
          studentId: { $ne: null },
          _id: { $in: memberIds.map(id => new ObjectId(id)) },
        } as any,
      });
    } else {
      // ── Target-based filtering ───────────────────────────────────────────
      switch (target) {

        case 'all':
          members = await memberRepo.find({
            where: { libraryId, status: 'active', studentId: { $ne: null } } as any,
          });
          break;

        case 'fee_due':
          members = await memberRepo.find({
            where: { libraryId, status: 'pending', studentId: { $ne: null } } as any,
          });
          break;

        case 'expired':
          members = await memberRepo.find({
            where: { libraryId, status: 'expired', studentId: { $ne: null } } as any,
          });
          break;

        case 'overdue':
          // active members whose endDate has already passed
          members = await memberRepo.find({
            where: {
              libraryId,
              status:  'active',
              endDate: { $lt: today },
              studentId: { $ne: null },
            } as any,
          });
          break;

        case 'absent': {
          // active members who have NOT checked in today
          const todayAttendance = await attendanceRepo.find({
            where: {
              libraryId,
              date:   today,
              status: { $in: ['checked_in', 'on_break', 'checked_out'] },
            } as any,
          });
          const presentIds = new Set(todayAttendance.map(a => a.studentId));
          const allActive  = await memberRepo.find({
            where: { libraryId, status: 'active', studentId: { $ne: null } } as any,
          });
          members = allActive.filter(m => !presentIds.has(m.studentId));
          break;
        }

        // ── Slot-type targets ────────────────────────────────────────────
        case 'fullday':
        case 'firsthalf':
        case 'secondhalf':
        case 'twentyfour':
        case 'halfday':
        case 'evening':
        case 'morning':
        case 'night':
        case 'custom':
          members = await memberRepo.find({
            where: {
              libraryId,
              status:    'active',
              slotId:    target,
              studentId: { $ne: null },
            } as any,
          });
          break;

        default:
          members = [];
      }
    }

    if (members.length === 0) return;

    const studentIds = [...new Set(members.map(m => m.studentId as string))];

    await sendFcmToStudents(studentIds, title, message);
    await saveInAppNotifications(studentIds, title, message, 'announcement', announcementId);

    // Update sentCount on the announcement
    const announcementRepo = getDataSource().getMongoRepository(AnnouncementModel);
    await announcementRepo.updateOne(
      { _id: new ObjectId(announcementId) } as any,
      { $set: { sentCount: studentIds.length, updatedAt: new Date() } },
    );

  } catch (err) {
    log.error('Cron: sendAnnouncementNotification failed', [err]);
  }
}

// ── NEW: subscription expiry (daily 10AM) ─────────────────────────────────
cron.schedule('0 10 * * *', async () => {
  try {
    // await runSubscriptionExpiryReminderJob();
  } catch (error) {
    log.error('Cron: Subscription expiry reminder job failed', [error]);
  }
});

  // ── Existing: timetable reminders (every minute) ──────────────────────────
  //  also runs slot-starting and not-checked-in every minute
cron.schedule('* * * * *', async () => {
  await Promise.allSettled([
    runTimetableReminderJob().catch(err =>
      log.error('Cron: Timetable reminder job failed', [err]),
    ),
    runSlotStartingReminderJob().catch(err =>
      log.error('Cron: Slot starting reminder job failed', [err]),
    ),
    runNotCheckedInReminderJob().catch(err =>
      log.error('Cron: Not checked-in reminder job failed', [err]),
    ),
    runCheckinReminderJob().catch(err =>     
      log.error('Cron: Check-in reminder job failed', [err]),
    ),
  ]);
});