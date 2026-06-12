import { DataSource } from 'typeorm';
import { ActivityModel } from '../../api/models/activity.model';
import { AnnouncementModel } from '../../api/models/announcement.model';
import { AttendanceModel } from '../../api/models/attendance.model';
import { AuthSessionModel } from '../../api/models/authSession.model';
import { BannerModel } from '../../api/models/banner.model';
import { BookingModel } from '../../api/models/booking.model';
import { FcmTokenModel } from '../../api/models/fcmToken.model';
import { LibraryModel } from '../../api/models/library.model';
import { LibraryRatingModel } from '../../api/models/libraryRating.model';
import { LibrarySeatModel } from '../../api/models/librarySeat.model';
import { LibraryTransferModel } from '../../api/models/libraryTransfer.model';
import { MemberModel } from '../../api/models/member.model';
import { MemberBulkUploadModel } from '../../api/models/memberBulkUpload.model';
import { MemberInviteLinkModel } from '../../api/models/memberInviteLink.model';
import { MemberInviteSubmissionModel } from '../../api/models/memberInviteSubmission.model';
import { MemberPaymentModel } from '../../api/models/memberPayment.model';
import { NotificationModel } from '../../api/models/notification.model';
import { PaymentModel } from '../../api/models/payment.model';
import { PendingOwnerSignupModel } from '../../api/models/pendingOwnerSignup.model';
import { PendingStudentSignupModel } from '../../api/models/pendingStudentSignup.model';
import { StudentModel } from '../../api/models/student.model';
import { StudySessionModel } from '../../api/models/studySession.model';
import { StudyTimetableModel } from '../../api/models/studyTimetable.model';
import { SuperAdminModel } from '../../api/models/superAdmin.model';
import { TenantModel } from '../../api/models/tenant.model';
import { UserModel } from '../../api/models/user.model';
import { env } from '../../env';
import { LibraryPaymentMethodModel } from '../../api/models/libraryPaymentMethod.model';
import { FeeRequestModel } from '../../api/models/feerequest.model';
import { MemberRenewalModel } from '../../api/models/memberRenewal.model';
import { SubscriptionPlanModel } from '../../api/models/subscriptionPlan.model';
import { LibrarySubscriptionModel } from '../../api/models/librarySubscription.model';
import { MemberLeaveRequestModel } from '../../api/models/memberLeaveRequest.model';
import { DeviceAppVersionModel } from '../../api/models/deviceAppVersion.model';
import { AppVersionModel } from '../../api/models/appVersion.model';
import { WebViewModel } from '../../api/models/webView.model';

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
          maxPoolSize: 100,
          minPoolSize: 10,
          maxIdleTimeMS: 60000,
          waitQueueTimeoutMS: 10000,
          serverSelectionTimeoutMS: 5000,
        }
      : {
          maxPoolSize: 100,
          minPoolSize: 10,
          maxIdleTimeMS: 60000,
          waitQueueTimeoutMS: 10000,
          serverSelectionTimeoutMS: 5000,
        },
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
      AttendanceModel,
      StudySessionModel,
      AnnouncementModel,
      NotificationModel,
      FcmTokenModel,
      MemberBulkUploadModel,
      MemberInviteLinkModel,
      SuperAdminModel,
      BannerModel,
      LibraryRatingModel,
      MemberPaymentModel,
      PaymentModel,
      MemberInviteSubmissionModel,
      LibraryTransferModel,
      LibraryPaymentMethodModel,
      FeeRequestModel,
      MemberRenewalModel,
      SubscriptionPlanModel,   
      LibrarySubscriptionModel,
      MemberLeaveRequestModel,
      AppVersionModel,
      DeviceAppVersionModel,
      WebViewModel
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

    console.error('✅ MongoDB Connected Successfully');

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
    console.error('MongoDB Disconnected');
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
