import 'reflect-metadata';
import { initEnv } from './bootstrap/initEnv';

/**
 * EXPRESS TYPESCRIPT APP
 * ----------------------------------------
 *
 * This is a app for Node.js Application written in TypeScript.
 * The basic layer of this app is express. For further information visit
 * the 'README.md' file.
 */
const start = async (): Promise<void> => {
  await initEnv();

  const { bootstrapMicroframework } = await import('microframework-w3tec');
  const { banner } = await import('./lib/banner');
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { Logger } = await import('./lib/logger');
  const { expressLoader } = await import('./loaders/expressLoader');
  const { homeLoader } = await import('./loaders/homeLoader');
  const { iocLoader } = await import('./loaders/iocLoader');
  const { mongooseLoader } = await import('./loaders/mongooseLoader');
  const { redisLoader } = await import('./loaders/redisLoader');
  const { socketLoader } = await import('./loaders/socketLoader');
  const { swaggerLoader } = await import('./loaders/swaggerLoader');
  const { winstonLoader } = await import('./loaders/winstonLoader');

  const log = new Logger(__filename);

  await bootstrapMicroframework({
    /**
     * Loader is a place where you can configure all your modules during microframework
     * bootstrap process. All loaders are executed one by one in a sequential order.
     */
    loaders: [
      winstonLoader,
      iocLoader,
      mongooseLoader,
      expressLoader,
      socketLoader,
      swaggerLoader,
      homeLoader,
      redisLoader,
    ],
  });

  await banner(log);
};

start().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error('Application crashed:', error.message);
    console.error(error.stack);
    return;
  }

  console.error('Application crashed with non-error payload:', error);
});
