import * as admin from 'firebase-admin';
import { env } from '../../env';

let firebaseApp: admin.app.App | null = null;

const parseFirebasePrivateKey = (raw: string): string => {
  let key = raw.trim();

  // Strip surrounding quotes if dotenv didn't remove them
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  // Replace literal \n sequences with real newlines
  key = key.replace(/\\n/g, '\n');

  return key;
};

export const initializeFirebase = (): void => {
  if (firebaseApp) {
    return;
  }

  const rawKey = env.firebase.privateKey ?? '';
  const privateKey = parseFirebasePrivateKey(rawKey);

  if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
    throw new Error(
      `FIREBASE_PRIVATE_KEY is malformed. Got: ${JSON.stringify(privateKey.slice(0, 60))}`,
    );
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey,
    }),
  });

  console.log('✅ Firebase initialized successfully | project:', env.firebase.projectId);
};

export const getFirebaseMessaging = (): admin.messaging.Messaging => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return admin.messaging(firebaseApp);
};