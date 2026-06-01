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
        ownerId: null,
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

async function saveInAppNotification(
  studentId: string,
  title: string,
  message: string,
  type: NotificationType,
  referenceId: string,
): Promise<void> {
  return saveInAppNotifications([studentId], title, message, type, referenceId);
}

/**
 * Returns "HH:mm" for now + offsetMinutes.
 *
 * Positive offset  → future time  (e.g. +10 = "what time will it be in 10 min")
 * Negative offset  → past time    (e.g. -15 = "what time was it 15 min ago")
 */
function hhmm(date: Date, offsetMinutes = 0): string {
  const d = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Member expiry job ─────────────────────────────────────────────────────────

export async function runMemberExpiryJob(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const memberRepo = getDataSource().getMongoRepository(MemberModel);
  const libraryRepo = getDataSource().getMongoRepository(LibraryModel);

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

// ── Revision reminders ────────────────────────────────────────────────────────
//
// FIX: Previously this job only checked revisionReminderDate <= now, which means
//      it only fired on a fixed date set at session creation — not per-student
//      daily schedule.
//
// NEW BEHAVIOUR:
//   • Each StudySession may have a `dailyRevisionTime` field (e.g. "14:30") set
//     by the student in the session form.  When that field is present the job
//     fires every day at that exact minute instead of a one-shot reminder date.
//   • The one-shot `revisionReminderDate` path is preserved for sessions that
//     don't have a daily time configured.
//   • Redis dedup key prevents double-firing within the same minute window.
//
// ASSUMED SCHEMA additions on StudySessionModel:
//   dailyRevisionTime?: string;   // "HH:mm" – student-chosen daily reminder time
//   lastRevisionReminderDate?: string; // "YYYY-MM-DD" – last day we fired daily reminder

export async function runRevisionReminderJob(): Promise<void> {
  const now = new Date();
  const currentHHMM = hhmm(now);           // e.g. "14:30"
  const todayDate   = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const sessionRepo = getDataSource().getMongoRepository(StudySessionModel);

  // ── Path A: one-shot reminder (revisionReminderDate) ──────────────────────
  // Original behaviour – fires once when revisionReminderDate <= now
  const oneShot = await sessionRepo.find({
    where: {
      deletedAt:            null,
      reminderSent:         { $ne: true },
      // Has a one-shot date but no daily time configured
      dailyRevisionTime:    { $in: [null, undefined, ''] },
      revisionReminderDate: { $ne: null, $lte: now },
    } as any,
  });

  for (const session of oneShot) {
    const sessionId = (session.id || (session as any)._id).toHexString();
    try {
      const dateStr = new Date(session.createdAt).toLocaleDateString();
      const title = '📖 Revision Reminder';
      const body  = `Time to revise your study session notes from ${dateStr}!`;
      await sendFcmToStudent(session.studentId, title, body);
      await saveInAppNotification(session.studentId, title, body, 'revision_reminder', sessionId);

      const fresh = await sessionRepo.findOneById(session.id || (session as any)._id);
      if (fresh) {
        fresh.reminderSent = true;
        fresh.updatedAt    = new Date();
        await sessionRepo.save(fresh);
      }
    } catch {
      log.warn(`Cron: One-shot revision reminder failed for session ${sessionId}`);
    }
  }

  // ── Path B: daily recurring reminder (dailyRevisionTime) ──────────────────
  // Fires every day at the student-chosen time. Each student can have multiple
  // sessions with different dailyRevisionTime values.
  const dailySessions = await sessionRepo.find({
    where: {
      deletedAt:         null,
      dailyRevisionTime: { $ne: null, $nin: ['', undefined] },
    } as any,
  });

  for (const session of dailySessions) {
    const sessionId = (session.id || (session as any)._id).toHexString();

    // Only fire at the student's chosen time (minute-level match)
    if ((session as any).dailyRevisionTime !== currentHHMM) continue;

    // Dedup: only once per day per session
    const redisKey = `revision:daily:${sessionId}:${todayDate}`;
    try {
      const alreadySent = await redisCache.get<string>(redisKey);
      if (alreadySent) continue;
      await redisCache.set(redisKey, '1', 86400); // TTL 24 h
    } catch {
      // Redis unavailable — use lastRevisionReminderDate field as fallback
      if ((session as any).lastRevisionReminderDate === todayDate) continue;
    }

    try {
      const dateStr = new Date(session.createdAt).toLocaleDateString();
      const title = '📖 Daily Revision Reminder';
      const body  = `Don't forget to revise your notes from ${dateStr}! Tap to review.`;
      await sendFcmToStudent(session.studentId, title, body);
      await saveInAppNotification(session.studentId, title, body, 'revision_reminder', sessionId);

      // Persist lastRevisionReminderDate so Redis outage doesn't cause duplicates
      const fresh = await sessionRepo.findOneById(session.id || (session as any)._id);
      if (fresh) {
        (fresh as any).lastRevisionReminderDate = todayDate;
        fresh.updatedAt = new Date();
        await sessionRepo.save(fresh);
      }
    } catch {
      log.warn(`Cron: Daily revision reminder failed for session ${sessionId}`);
    }
  }

  const total = oneShot.length + dailySessions.filter(
    s => (s as any).dailyRevisionTime === currentHHMM,
  ).length;
  if (total > 0) {
    log.info(`Cron: Processed ${total} revision reminder(s) at ${currentHHMM}`);
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

// ── Timetable reminders ───────────────────────────────────────────────────────

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

// ── Auto checkout ─────────────────────────────────────────────────────────────

export async function runAutoCheckoutJob(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const attendanceRepo = getDataSource().getMongoRepository(AttendanceModel);
  const bookingRepo    = getDataSource().getMongoRepository(BookingModel);

  const checkedIn = await attendanceRepo.find({
    where: {
      status: 'checked_in',
      $or: [
        { date: { $lt: today } },
        { checkInTime: { $lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
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
        const checkInDate = new Date(record.checkInTime);
        checkOutTime = new Date(checkInDate.getTime() + 24 * 60 * 60 * 1000);
      } else if (booking?.slotEndTime) {
        const [hour, minute] = (booking.slotEndTime as string).split(':').map(Number);
        const hh = String(hour).padStart(2, '0');
        const mm = String(minute).padStart(2, '0');
        checkOutTime = new Date(`${record.date}T${hh}:${mm}:00`);
      } else {
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

// ── Session expiry reminders (1 day + 3 days before endDate) ─────────────────

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

// ── Fee due reminders ─────────────────────────────────────────────────────────

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

// ── Owner push helpers (called directly from services, not crons) ─────────────

export async function sendOwnerBookingRequestPush(
  ownerId: string,
  studentName: string,
  libraryName: string,
  bookingId: string,
): Promise<void> {
  const title = '🔔 New Membership Request';
  const body = `${studentName} has requested to join ${libraryName}. Tap to review.`;
  await sendFcmToOwners([ownerId], title, body);
  await saveOwnerNotification(ownerId, title, body, 'booking_request', bookingId);
}

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

// ── Subscription expiry reminders ─────────────────────────────────────────────

export async function runSubscriptionExpiryReminderJob(): Promise<void> {
  try {
    const memberRepo   = getDataSource().getMongoRepository(MemberModel);
    const libraryRepo  = getDataSource().getMongoRepository(LibraryModel);

    for (const daysAhead of [1, 3, 7]) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysAhead);
      const targetDateStr = targetDate.toISOString().slice(0, 10);

      const expiringMembers = await memberRepo.find({
        where: {
          status:    'active',
          endDate:   targetDateStr,
          studentId: { $ne: null },
        } as any,
      });

      if (expiringMembers.length === 0) continue;

      const libraryNameCache = new Map<string, string>();

      for (const member of expiringMembers) {
        try {
          let libraryName: string;

          if (libraryNameCache.has(member.libraryId)) {
            libraryName = libraryNameCache.get(member.libraryId)!;
          } else {
            const library = await libraryRepo.findOne({
              where: { _id: new ObjectId(member.libraryId) } as any,
            });
            if (!library) continue;
            libraryName = library.name;
            libraryNameCache.set(member.libraryId, libraryName);
          }

          const title = '📅 Membership Expiring Soon';
          const body  = `Your membership at ${libraryName} is expiring on ${member.endDate}. Renew now to keep your seat!`;

          await sendFcmToStudents([member.studentId as string], title, body);
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

// ── Check-in reminder ─────────────────────────────────────────────────────────
//
// FIX: The original code used hhmm(now, -10) to find the "10-min before" slot,
//      which actually finds slots that STARTED 10 minutes ago — not slots that
//      START in 10 minutes.
//
//      Correct mapping:
//        "Remind 10 min BEFORE slot starts at T"
//          → fire when now == T - 10
//          → slot.startTime == hhmm(now, +10)   ← ADD 10 to now
//
//        "Remind 15 min AFTER slot started at T" (already checked-in variants)
//          → fire when now == T + 15
//          → slot.startTime == hhmm(now, -15)   ← SUBTRACT 15 from now  ✅ (was correct)
//
//        "Remind 30 min AFTER slot started at T"
//          → slot.startTime == hhmm(now, -30)   ← SUBTRACT 30 from now  ✅ (was correct)
//
// SUMMARY OF CHANGES vs original:
//   • minus10  → plus10  (hhmm(now, +10)) for the "10 min before" bucket
//   • minus30  unchanged — correctly finds slots that started 30 min ago
//   • Added slot-end notifications: 5 min BEFORE end + 15 min AFTER end

export async function runCheckinReminderJob(): Promise<void> {
  try {
    const now = new Date();
    const libraryRepo    = getDataSource().getMongoRepository(LibraryModel);
    const memberRepo     = getDataSource().getMongoRepository(MemberModel);
    const attendanceRepo = getDataSource().getMongoRepository(AttendanceModel);

    const today = now.toISOString().slice(0, 10);

    // ── Time targets ─────────────────────────────────────────────────────────
    // "10 min before slot start" → slot whose startTime = now + 10
    const startIn10  = hhmm(now, +10);  // FIX: was hhmm(now, -10)
    // "30 min after slot start" → slot whose startTime = now - 30
    const startedAgo30 = hhmm(now, -30); // unchanged — was correct

    // Slot-end notifications (NEW):
    // "5 min before slot ends" → slot whose endTime = now + 5
    const endIn5    = hhmm(now, +5);
    // "15 min after slot ended" → slot whose endTime = now - 15
    const endedAgo15 = hhmm(now, -15);

    const libraries = await libraryRepo.find({
      where: { isActive: true, deletedAt: null } as any,
    });

    for (const library of libraries) {
      const libraryId = (library.id || (library as any)._id).toHexString();

      // Fetch today's attendance once per library
      const todayAttendance = await attendanceRepo.find({
        where: {
          libraryId,
          date:   today,
          status: { $in: ['checked_in', 'on_break'] },
        } as any,
      });
      const checkedInIds = new Set(todayAttendance.map(a => a.studentId));

      // Fetch checked-out records for slot-end notifications
      const todayCheckedOut = await attendanceRepo.find({
        where: {
          libraryId,
          date:   today,
          status: 'checked_out',
        } as any,
      });
      const checkedOutIds = new Set(todayCheckedOut.map(a => a.studentId));

      for (const slot of (library.slots ?? [])) {
        if (!slot.isActive) continue;

        const slotIdentifier = (slot as any).slotId ?? slot.slotType;

        // ── 10 min BEFORE slot start ─────────────────────────────────────────
        // FIX: now correctly fires for slots starting in 10 minutes
        if (slot.startTime === startIn10) {
          const members = await memberRepo.find({
            where: {
              libraryId,
              slotId:    slotIdentifier,
              status:    'active',
              studentId: { $ne: null },
            } as any,
          });

          const studentIds = [
            ...new Set(
              members
                .map(m => m.studentId as string)
                .filter(id => !checkedInIds.has(id)),
            ),
          ];

          if (studentIds.length > 0) {
            const redisKey = `checkin:10min:${libraryId}:${slotIdentifier}:${today}`;
            try {
              const sent = await redisCache.get<string>(redisKey);
              if (sent) continue;
              await redisCache.set(redisKey, '1', 3600);
            } catch { /* proceed without dedup */ }

            const title = '⏰ Check-in Reminder';
            const body  = `Your ${slot.name} slot at ${library.name} starts in 10 minutes. Don't forget to check in!`;
            await sendFcmToStudents(studentIds, title, body);
            await saveInAppNotifications(studentIds, title, body, 'checkin_reminder', libraryId);
            log.info(`Cron: 10-min check-in reminder → ${studentIds.length} student(s) for slot ${slot.name}`);
          }
        }

        // ── 30 min AFTER slot start ──────────────────────────────────────────
        if (slot.startTime === startedAgo30) {
          const members = await memberRepo.find({
            where: {
              libraryId,
              slotId:    slotIdentifier,
              status:    'active',
              studentId: { $ne: null },
            } as any,
          });

          const studentIds = [
            ...new Set(
              members
                .map(m => m.studentId as string)
                .filter(id => !checkedInIds.has(id)),
            ),
          ];

          if (studentIds.length > 0) {
            const redisKey = `checkin:30min:${libraryId}:${slotIdentifier}:${today}`;
            try {
              const sent = await redisCache.get<string>(redisKey);
              if (sent) continue;
              await redisCache.set(redisKey, '1', 3600);
            } catch { /* proceed without dedup */ }

            const title = '📍 Still Not Checked In?';
            const body  = `Your ${slot.name} slot at ${library.name} started 30 minutes ago. Check in now before you're marked absent!`;
            await sendFcmToStudents(studentIds, title, body);
            await saveInAppNotifications(studentIds, title, body, 'checkin_reminder', libraryId);
            log.info(`Cron: 30-min check-in reminder → ${studentIds.length} student(s) for slot ${slot.name}`);
          }
        }

        // ── NEW: 5 min BEFORE slot END ────────────────────────────────────────
        // Requires slot.endTime to be stored on the slot object (e.g. "18:00")
        // slot.endTime exists directly on LibrarySlot
        const slotEndTime: string | undefined = slot.endTime;
        if (!slotEndTime) continue;

        if (slotEndTime === endIn5) {
          const members = await memberRepo.find({
            where: {
              libraryId,
              slotId:    slotIdentifier,
              status:    'active',
              studentId: { $ne: null },
            } as any,
          });

          // Notify students who ARE checked in (remind them slot is ending soon)
          const studentIds = [
            ...new Set(
              members
                .map(m => m.studentId as string)
                .filter(id => checkedInIds.has(id)),
            ),
          ];

          if (studentIds.length > 0) {
            const redisKey = `checkout:5min:${libraryId}:${slotIdentifier}:${today}`;
            try {
              const sent = await redisCache.get<string>(redisKey);
              if (sent) continue;
              await redisCache.set(redisKey, '1', 3600);
            } catch { /* proceed without dedup */ }

            const title = '🔔 Slot Ending Soon';
            const body  = `Your ${slot.name} slot at ${library.name} ends in 5 minutes. Please wrap up and check out!`;
            await sendFcmToStudents(studentIds, title, body);
            await saveInAppNotifications(studentIds, title, body, 'checkin_reminder', libraryId);
            log.info(`Cron: 5-min slot-end reminder → ${studentIds.length} student(s) for slot ${slot.name}`);
          }
        }

        // ── NEW: 15 min AFTER slot END ────────────────────────────────────────
        if (slotEndTime === endedAgo15) {
          const members = await memberRepo.find({
            where: {
              libraryId,
              slotId:    slotIdentifier,
              status:    'active',
              studentId: { $ne: null },
            } as any,
          });

          // Notify students who are STILL checked in (forgot to check out)
          // OR students who already checked out today (slot is officially over — confirm)
          const stillCheckedIn = [
            ...new Set(
              members
                .map(m => m.studentId as string)
                .filter(id => checkedInIds.has(id)),
            ),
          ];

          const alreadyCheckedOut = [
            ...new Set(
              members
                .map(m => m.studentId as string)
                .filter(id => checkedOutIds.has(id)),
            ),
          ];

          // Students still checked in → prompt them to check out
          if (stillCheckedIn.length > 0) {
            const redisKey = `checkout:15min-overdue:${libraryId}:${slotIdentifier}:${today}`;
            try {
              const sent = await redisCache.get<string>(redisKey);
              if (!sent) {
                await redisCache.set(redisKey, '1', 3600);
                const title = '⚠️ Your Slot Has Ended';
                const body  = `Your ${slot.name} slot at ${library.name} ended 15 minutes ago. Please check out now!`;
                await sendFcmToStudents(stillCheckedIn, title, body);
                await saveInAppNotifications(stillCheckedIn, title, body, 'checkin_reminder', libraryId);
                log.info(`Cron: 15-min slot-ended (overdue) → ${stillCheckedIn.length} student(s) for slot ${slot.name}`);
              }
            } catch { /* proceed without dedup */ }
          }

          // Students already checked out → send a completion confirmation
          if (alreadyCheckedOut.length > 0) {
            const redisKey = `checkout:15min-done:${libraryId}:${slotIdentifier}:${today}`;
            try {
              const sent = await redisCache.get<string>(redisKey);
              if (!sent) {
                await redisCache.set(redisKey, '1', 3600);
                const title = '✅ Slot Completed';
                const body  = `Great job! Your ${slot.name} session at ${library.name} is complete. See you tomorrow!`;
                await sendFcmToStudents(alreadyCheckedOut, title, body);
                await saveInAppNotifications(alreadyCheckedOut, title, body, 'checkin_reminder', libraryId);
                log.info(`Cron: 15-min slot-completed (done) → ${alreadyCheckedOut.length} student(s) for slot ${slot.name}`);
              }
            } catch { /* proceed without dedup */ }
          }
        }
      }
    }
  } catch (err) {
    log.error('Cron: runCheckinReminderJob failed', [err]);
  }
}

// ── Not checked-in reminder (15 min after slot start) ────────────────────────

export async function runNotCheckedInReminderJob(): Promise<void> {
  try {
    const now = new Date();
    const targetTime = hhmm(now, -15); // slots that started exactly 15 min ago
    const today = now.toISOString().slice(0, 10);

    const libraryRepo    = getDataSource().getMongoRepository(LibraryModel);
    const memberRepo     = getDataSource().getMongoRepository(MemberModel);
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

      const todayAttendance = await attendanceRepo.find({
        where: {
          libraryId,
          date:   today,
          status: { $in: ['checked_in', 'on_break'] },
        } as any,
      });
      const presentIds = new Set(todayAttendance.map(a => a.studentId));

      for (const slot of matchingSlots) {
        const slotIdentifier = (slot as any).slotId ?? slot.slotType;

        const members = await memberRepo.find({
          where: {
            libraryId,
            slotId:    slotIdentifier,
            status:    'active',
            studentId: { $ne: null },
          } as any,
        });

        const studentIds = [
          ...new Set(
            members
              .map(m => m.studentId as string)
              .filter(id => !presentIds.has(id)),
          ),
        ];
        if (studentIds.length === 0) continue;

        const title = '📍 You Haven\'t Checked In Yet';
        const body  = `Your ${slot.name} slot at ${library.name} started 15 minutes ago. Check in now!`;

        await sendFcmToStudents(studentIds, title, body);
        await saveInAppNotifications(studentIds, title, body, 'slot_not_checked_in', libraryId);
      }
    }
  } catch (err) {
    log.error('Cron: runNotCheckedInReminderJob failed', [err]);
  }
}

// ── Announcement notification ──────────────────────────────────────────────────

export async function sendAnnouncementNotification(
  announcementId: string,
  libraryId:      string,
  title:          string,
  message:        string,
  target:         AnnouncementTarget,
  memberIds?:     string[],
): Promise<void> {
  try {
    const memberRepo     = getDataSource().getMongoRepository(MemberModel);
    const today          = new Date().toISOString().slice(0, 10);
    const attendanceRepo = getDataSource().getMongoRepository(AttendanceModel);

    let members: MemberModel[] = [];

    if (memberIds && memberIds.length > 0) {
      members = await memberRepo.find({
        where: {
          libraryId,
          studentId: { $ne: null },
          _id: { $in: memberIds.map(id => new ObjectId(id)) },
        } as any,
      });
    } else {
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
          members = await memberRepo.find({
            where: {
              libraryId,
              status:    'active',
              endDate:   { $lt: today },
              studentId: { $ne: null },
            } as any,
          });
          break;

        case 'absent': {
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

    const announcementRepo = getDataSource().getMongoRepository(AnnouncementModel);
    await announcementRepo.updateOne(
      { _id: new ObjectId(announcementId) } as any,
      { $set: { sentCount: studentIds.length, updatedAt: new Date() } },
    );
  } catch (err) {
    log.error('Cron: sendAnnouncementNotification failed', [err]);
  }
}

// ── Push helpers (called directly from services) ──────────────────────────────

export async function sendOwnerInviteSubmissionPush(
  ownerId:      string,
  studentName:  string,
  libraryName:  string,
  submissionId: string,
): Promise<void> {
  const title = '📋 New Join Request';
  const body  = `${studentName} has submitted a join request for ${libraryName}. Tap to review.`;
  await sendFcmToOwners([ownerId], title, body);
  await saveOwnerNotification(ownerId, title, body, 'booking_request', submissionId);
}

export async function sendOwnerRenewalRequestPush(
  ownerId:        string,
  studentName:    string,
  libraryName:    string,
  memberId:       string,
  paymentMethod:  string,
  screenshotUrl?: string | null,
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
    hasScreenshot ? `${body} Screenshot: ${screenshotUrl}` : body,
    'renewal_request',
    memberId,
  );
}

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

export async function sendOwnerSubscriptionExpiringPush(
  ownerId:     string,
  libraryName: string,
  daysLeft:    number,
  libraryId:   string,
): Promise<void> {
  const title = '⚠️ Subscription Expiring Soon';
  const body  = `Your ${libraryName} subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Renew to keep access.`;
  await sendFcmToOwners([ownerId], title, body);
  await saveOwnerNotification(ownerId, title, body, 'subscription_expiring', libraryId);
}

// ── Cron loader ───────────────────────────────────────────────────────────────

export const cronLoader: MicroframeworkLoader = () => {

  // Every 12 hours — member expiry with Redis distributed lock
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

  // Every minute — revision reminders (now checks per-student dailyRevisionTime)
  // FIX: Changed from */30 to * * * * * so student-chosen times fire on the exact minute
  cron.schedule('* * * * *', async () => {
    try {
      await runRevisionReminderJob();
    } catch (error) {
      log.error('Cron: Revision reminder job failed', [error]);
    }
  });

  // Midnight — auto checkout
  cron.schedule('0 0 * * *', async () => {
    try {
      await runAutoCheckoutJob();
    } catch (error) {
      log.error('Cron: Auto-checkout job failed', [error]);
    }
  });

  // Daily 9 AM — session expiry + fee due reminders
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

  // Daily 10 AM — subscription/membership expiry reminders (1, 3, 7 days ahead)
  cron.schedule('0 10 * * *', async () => {
    try {
      await runSubscriptionExpiryReminderJob();
    } catch (error) {
      log.error('Cron: Subscription expiry reminder job failed', [error]);
    }
  });

  // Every minute — timetable, check-in, not-checked-in, slot-end reminders
  cron.schedule('* * * * *', async () => {
    await Promise.allSettled([
      runTimetableReminderJob().catch(err =>
        log.error('Cron: Timetable reminder job failed', [err]),
      ),
      runCheckinReminderJob().catch(err =>
        log.error('Cron: Check-in reminder job failed', [err]),
      ),
      runNotCheckedInReminderJob().catch(err =>
        log.error('Cron: Not checked-in reminder job failed', [err]),
      ),
    ]);
  });

  log.info('Cron jobs loaded');
};