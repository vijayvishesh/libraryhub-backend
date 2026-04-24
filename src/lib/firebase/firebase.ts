import * as admin from 'firebase-admin';
import { env } from '../../env';

let firebaseApp: admin.app.App | null = null;

export const initializeFirebase = (): void => {
  if (firebaseApp) return;

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    }),
  });

  console.log('✅ Firebase initialized successfully');
};

export const getFirebaseMessaging = (): admin.messaging.Messaging => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return admin.messaging(firebaseApp);
};