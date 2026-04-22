import { DataSource } from 'typeorm';
import { ActivityModel } from '../../api/models/activity.model';
import { AuthSessionModel } from '../../api/models/authSession.model';
import { BookingModel } from '../../api/models/booking.model';
import { LibraryModel } from '../../api/models/library.model';
import { LibrarySeatModel } from '../../api/models/librarySeat.model';
import { MemberModel } from '../../api/models/member.model';
import { PendingOwnerSignupModel } from '../../api/models/pendingOwnerSignup.model';
import { PendingStudentSignupModel } from '../../api/models/pendingStudentSignup.model';
import { StudentModel } from '../../api/models/student.model';
import { StudyTimetableModel } from '../../api/models/studyTimetable.model';
import { TenantModel } from '../../api/models/tenant.model';
import { UserModel } from '../../api/models/user.model';
import { env } from '../../env';

let appDataSource: DataSource | null = null;
let isConnected = false;
let connectionAttempts = 0;

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 5000;

const isAtlas = env.db.DB_URL.includes('mongodb+srv');

const createDataSource = (): DataSource =>
  new DataSource({
    type: 'mongodb',
    url: env.db.DB_URL,
    ssl: isAtlas,
    extra: isAtlas
      ? {
          tls: true,
          tlsInsecure: false,
          retryWrites: true,
          w: 'majority',
        }
      : {},
    entities: [
      UserModel,
      TenantModel,
      StudentModel,
      LibraryModel,
      LibrarySeatModel,
      PendingOwnerSignupModel,
      PendingStudentSignupModel,
      AuthSessionModel,
      BookingModel,
      MemberModel,
      ActivityModel,
      StudyTimetableModel,
    ],
    synchronize: true,
    logging: false,
  });

const resolveHostFromUrl = (url: string): string | undefined => {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
};

export const getDataSource = (): DataSource => {
  if (!appDataSource || !appDataSource.isInitialized) {
    throw new Error('Database connection is not initialized');
  }

  return appDataSource;
};

export const connectDatabase = async (): Promise<void> => {
  if (!env.db.enabled) {
    isConnected = false;
    connectionAttempts = 0;
    return;
  }

  try {
    if (appDataSource?.isInitialized) {
      isConnected = true;
      connectionAttempts = 0;
      return;
    }

    appDataSource = createDataSource();
    await appDataSource.initialize();

    console.log('✅ MongoDB Connected Successfully');

    isConnected = true;
    connectionAttempts = 0;
  } catch (error) {
    isConnected = false;
    console.error('❌ Error connecting to MongoDB with TypeORM:', error);

    if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
      connectionAttempts += 1;
      console.warn(
        `Retrying database connection... Attempt ${connectionAttempts}/${MAX_RETRY_ATTEMPTS}`,
      );
      setTimeout(() => {
        void connectDatabase();
      }, RETRY_DELAY_MS);
      return;
    }

    console.error('❌ Max database connection retry attempts reached.');
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (!env.db.enabled) {
    isConnected = false;
    appDataSource = null;
    return;
  }

  if (!appDataSource || !appDataSource.isInitialized) {
    isConnected = false;
    return;
  }

  try {
    await appDataSource.destroy();
    console.log('🔌 MongoDB Disconnected');
    isConnected = false;
    appDataSource = null;
  } catch (error) {
    console.error('Error disconnecting MongoDB DataSource:', error);
  }
};

export const isDatabaseConnected = (): boolean =>
  Boolean(env.db.enabled && isConnected && appDataSource?.isInitialized);

export const isDatabaseEnabled = (): boolean => env.db.enabled;

export const getDatabaseStatus = (): {
  enabled: boolean;
  connected: boolean;
  readyState: string;
  host?: string;
} => {
  if (!env.db.enabled) {
    return {
      enabled: false,
      connected: false,
      readyState: 'disabled',
      host: resolveHostFromUrl(env.db.DB_URL),
    };
  }

  const connected = isDatabaseConnected();
  return {
    enabled: true,
    connected,
    readyState: connected ? 'connected' : 'disconnected',
    host: resolveHostFromUrl(env.db.DB_URL),
  };
};

process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});