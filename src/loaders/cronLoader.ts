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
    const tokenDocs = await fcmRepo.find({
      where: { ownerId: { $in: ownerIds } } as any,
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

  const result = await memberRepo.updateMany(
    { status: 'active', endDate: { $lt: today } },
    { $set: { status: 'expired', paidAt: null, updatedAt: new Date() } },
  );

  if (result.modifiedCount > 0) {
    log.info(`Cron: Expired ${result.modifiedCount} members`);
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

// ── Auto-checkout (unchanged) ─────────────────────────────────────────────────

export async function runAutoCheckoutJob(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const attendanceRepo = getDataSource().getMongoRepository(AttendanceModel);
  const bookingRepo = getDataSource().getMongoRepository(BookingModel);

  const checkedIn = await attendanceRepo.find({
    where: { status: 'checked_in', date: { $lt: today } } as any,
  });

  let count = 0;
  for (const record of checkedIn) {
    try {
      const booking = await bookingRepo.findOne({
        where: {
          studentId: record.studentId,
          libraryId: record.libraryId,
          status: 'confirmed',
        } as any,
        order: { createdAt: 'DESC' } as any,
      });

      let checkOutTime: Date;
      if (booking?.slotEndTime) {
        const [hour, minute] = (booking.slotEndTime as string).split(':').map(Number);
        const hh = String(hour).padStart(2, '0');
        const mm = String(minute).padStart(2, '0');
        checkOutTime = new Date(`${record.date}T${hh}:${mm}:00`);
      } else {
        checkOutTime = new Date(`${record.date}T23:59:59`);
      }

      await attendanceRepo.updateOne(
        { _id: record.id } as any,
        { $set: { checkOutTime, status: 'checked_out', updatedAt: new Date() } },
      );
      count++;
    } catch {
      log.warn(
        `Cron: Auto-checkout failed for ${record.studentId}/${record.libraryId}/${record.date}`,
      );
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
): Promise<void> {
  await sendFcmToOwners(
    [ownerId],
    '🔔 New Membership Request',
    `${studentName} has requested to join ${libraryName}. Tap to review.`,
  );
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

  // ── Existing: timetable reminders (every minute) ──────────────────────────
  // NEW: also runs slot-starting and not-checked-in every minute
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
    ]);
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