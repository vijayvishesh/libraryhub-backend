import { MicroframeworkLoader, MicroframeworkSettings } from 'microframework-w3tec';
import { connectDatabase, disconnectDatabase } from '../database/config/ormconfig.default';
import { env } from '../env';
import { seedSuperAdmins } from '../database/seeds/superAdmin.seed';

export const mongooseLoader: MicroframeworkLoader = async (settings: MicroframeworkSettings | undefined) => {
  if (!env.db.enabled) {
    if (settings) {
      settings.setData('mongooseConnection', false);
    }
    return;
  }

  try {
    await connectDatabase();
    await seedSuperAdmins();

    if (settings) {
      settings.setData('mongooseConnection', true);
      settings.onShutdown(() => disconnectDatabase());
    }
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};
