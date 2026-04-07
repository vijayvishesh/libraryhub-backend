import mongoose from 'mongoose';
import { env } from '../../env';

let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 5000; // 5 seconds

export const connectDatabase = async (): Promise<void> => {
  if (!env.db.enabled) {
    isConnected = false;
    connectionAttempts = 0;
    return;
  }

  try {
    // Configure mongoose with resilient connection options
    mongoose.set('strictQuery', false);

    await mongoose.connect(env.db.DB_URL, {
      sanitizeFilter: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 30000, // Close sockets after 30 seconds of inactivity
      retryWrites: true,
      retryReads: true,
    });

    isConnected = true;
    connectionAttempts = 0;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    isConnected = false;

    // Implement retry logic
    if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
      connectionAttempts++;
      console.warn(`Retrying connection... Attempt ${connectionAttempts}/${MAX_RETRY_ATTEMPTS}`);
      setTimeout(() => connectDatabase(), RETRY_DELAY);
    } else {
      console.error('Max connection attempts reached. Please check your MongoDB connection.');
      // Don't exit the process, let the application handle gracefully
    }
  }
};

const db = mongoose.connection;

db.on('connecting', () => {
  isConnected = false;
});

db.on('error', (error) => {
  console.error(`MongoDB connection error: ${error}`);
  isConnected = false;
});

db.on('connected', () => {
  isConnected = true;
  connectionAttempts = 0;
});

db.on('reconnected', () => {
  isConnected = true;
  connectionAttempts = 0;
});

db.on('disconnected', () => {
  console.warn('MongoDB disconnected! Attempting to reconnect...');
  isConnected = false;

  // Attempt to reconnect
  if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
    setTimeout(() => connectDatabase(), RETRY_DELAY);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

export const disconnectDatabase = async (): Promise<void> => {
  if (!env.db.enabled) {
    isConnected = false;
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
  }
};

// Health check function
export const isDatabaseConnected = (): boolean => isConnected && mongoose.connection.readyState === 1;

export const isDatabaseEnabled = (): boolean => env.db.enabled;

// Database health check with detailed status
export const getDatabaseStatus = (): {
  enabled: boolean;
  connected: boolean;
  readyState: string;
  host?: string;
} => {
  const readyStates: Record<number, string> = {
    [0]: 'disconnected',
    [1]: 'connected',
    [2]: 'connecting',
    [3]: 'disconnecting',
  };

  return {
    enabled: env.db.enabled,
    connected: isConnected && mongoose.connection.readyState === 1,
    readyState: env.db.enabled ? readyStates[mongoose.connection.readyState] || 'unknown' : 'disabled',
    host: mongoose.connection.host,
  };
};
