import { MicroframeworkLoader } from 'microframework-w3tec';
import * as cron from 'node-cron';
import { AttendanceModel } from '../api/models/attendance.model';
import { BookingModel } from '../api/models/booking.model';
import { FcmTokenModel } from '../api/models/fcmToken.model';
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

// ── FCM helpers ───────────────────────────────────────────────────────────────

async function sendFcmToStudent(studentId: string, title: string, body: string): Promise<void> {
  try {
    const fcmRepo = getDataSource().getMongoRepository(FcmTokenModel);
    const tokenDocs = await fcmRepo.find({ where: { studentId } as any });
    const tokens = tokenDocs.map(t => t.token).filter(Boolean);
    if (tokens.length === 0) {
      return;
    }

    const messaging = getFirebaseMessaging();
    await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
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
  try {
    const notifRepo = getDataSource().getMongoRepository(NotificationModel);
    const now = new Date();
    await notifRepo.save(
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
  } catch {
    // non-critical
  }
}

// ── Study session revision reminders ──────────────────────────────────────────

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
      await sendFcmToStudent(
        session.studentId,
        'Revision Reminder',
        `Time to revise your study session notes from ${dateStr}!`,
      );
      await saveInAppNotification(
        session.studentId,
        'Revision Reminder',
        `Time to revise your study session notes from ${dateStr}!`,
        'system',
        sessionId,
      );
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

// ── Timetable study reminders ──────────────────────────────────────────────────

// In-process dedup: prevents double-firing within the same minute when Redis is off.
// Key format: `{timetableId}:{subjectIdx}:{YYYY-MM-DD}`
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

  // Purge stale in-process entries older than 24 h
  const staleBefore = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, ts] of timetableReminderSentCache) {
    if (ts < staleBefore) {
      timetableReminderSentCache.delete(key);
    }
  }

  for (const timetable of activeTimetables) {
    const timetableId = (timetable.id || (timetable as any)._id).toHexString();
    const subjects: TimetableSubject[] = timetable.subjects ?? [];

    for (let idx = 0; idx < subjects.length; idx++) {
      const subject = subjects[idx];
      if (!subject.reminder?.enabled || !subject.reminder.minutesBefore) {
        continue;
      }
      if (!subject.days.includes(todayName)) {
        continue;
      }

      const [startHour, startMin] = subject.startTime.split(':').map(Number);
      const fireAtMinutes = startHour * 60 + startMin - subject.reminder.minutesBefore;

      // Fire only when we are within a 1-minute window of the scheduled time
      if (Math.abs(currentMinutes - fireAtMinutes) > 1) {
        continue;
      }

      const inProcessKey = `${timetableId}:${idx}:${todayDate}`;
      const redisKey = `timetable:reminder:${timetableId}:${idx}:${todayDate}`;

      // Redis dedup (if available), in-process fallback
      try {
        const alreadySent = await redisCache.get<string>(redisKey);
        if (alreadySent) {
          continue;
        }
        await redisCache.set(redisKey, '1', 7200); // 2-hour TTL
      } catch {
        // Redis unavailable — use in-process dedup
        if (timetableReminderSentCache.has(inProcessKey)) {
          continue;
        }
      }

      timetableReminderSentCache.set(inProcessKey, Date.now());

      const title = `Study Reminder: ${subject.subjectName}`;
      const body = `Your ${subject.subjectName} session starts in ${subject.reminder.minutesBefore} min (${subject.startTime})`;

      await sendFcmToStudent(timetable.studentId, title, body);
      await saveInAppNotification(timetable.studentId, title, body, 'system', timetableId);
    }
  }
}

// ── Midnight auto-checkout ─────────────────────────────────────────────────────

export async function runAutoCheckoutJob(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const attendanceRepo = getDataSource().getMongoRepository(AttendanceModel);
  const bookingRepo = getDataSource().getMongoRepository(BookingModel);

  // Find all attendance records still checked-in from before today (previous day sessions)
  const checkedIn = await attendanceRepo.find({
    where: { status: 'checked_in', date: { $lt: today } } as any,
  });

  let count = 0;
  for (const record of checkedIn) {
    try {
      // CASE 1 & 3: find the student's confirmed booking to get slot end time
      const booking = await bookingRepo.findOne({
        where: { studentId: record.studentId, libraryId: record.libraryId, status: 'confirmed' } as any,
        order: { createdAt: 'DESC' } as any,
      });

      let checkOutTime: Date;
      if (booking?.slotEndTime) {
        // CASE 1: use slot end time so checkout reflects actual slot, not cron execution time
        const [hour, minute] = (booking.slotEndTime as string).split(':').map(Number);
        const hh = String(hour).padStart(2, '0');
        const mm = String(minute).padStart(2, '0');
        checkOutTime = new Date(`${record.date}T${hh}:${mm}:00`);
      } else {
        // CASE 3: 24-hour inactive fallback — end of the attendance day
        checkOutTime = new Date(`${record.date}T23:59:59`);
      }

      // CASE 4: process each checked_in record individually (multiple sessions per day)
      await attendanceRepo.updateOne(
        { _id: record.id } as any,
        { $set: { checkOutTime, status: 'checked_out', updatedAt: new Date() } },
      );
      count++;
    } catch {
      log.warn(`Cron: Auto-checkout failed for ${record.studentId}/${record.libraryId}/${record.date}`);
    }
  }

  if (count > 0) {
    log.info(`Cron: Auto-checked-out ${count} attendance record(s)`);
  }
}

export const cronLoader: MicroframeworkLoader = () => {
  cron.schedule('0 0,12 * * *', async () => {
    let lockAcquired = false;

    try {
      // Try to acquire a distributed lock to prevent concurrent runs across instances.
      // setNX returns true if the lock was acquired, false if Redis is disabled or lock is held.
      const acquired = await redisCache.setNX(LOCK_KEY, '1', LOCK_TTL_SECONDS);
      if (acquired) {
        lockAcquired = true;
      } else {
        // Distinguish: lock held by another instance (Redis enabled, NX failed) vs Redis disabled.
        // If Redis is disabled, setNX always returns false — we should run without a lock.
        // Test reachability: attempt a GET; if it returns without throwing, Redis is up.
        try {
          await redisCache.get<string>(LOCK_KEY);
          // Redis is reachable → another instance holds the lock, skip this run
          log.info('[Cron] member-expiry lock held by another instance, skipping');
          return;
        } catch {
          // Redis unavailable → run without lock
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
        } catch {
          // ignore cleanup errors
        }
      }
    }
  });

  // Session revision reminders — every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      await runRevisionReminderJob();
    } catch (error) {
      log.error('Cron: Revision reminder job failed', [error]);
    }
  });

  // Timetable study reminders — every minute
  cron.schedule('* * * * *', async () => {
    try {
      await runTimetableReminderJob();
    } catch (error) {
      log.error('Cron: Timetable reminder job failed', [error]);
    }
  });

  // Midnight auto-checkout: mark checked_in attendance from previous days as checked_out
  cron.schedule('0 0 * * *', async () => {
    try {
      await runAutoCheckoutJob();
    } catch (error) {
      log.error('Cron: Auto-checkout job failed', [error]);
    }
  });

  log.info('Cron jobs loaded');
};
