import * as dotenv from 'dotenv';
import * as path from 'path';
import {
  getOsEnv,
  getOsEnvArray,
  getOsEnvOptional,
  getOsPath,
  getOsPaths,
  normalizePort,
  toBool,
  toNumber,
} from './lib/env';

dotenv.config({
  path: path.join(process.cwd(), `.env${process.env.NODE_ENV === 'test' ? '.test' : ''}`),
});

export const env = {
  node: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  isDevelopment: process.env.NODE_ENV === 'development',
  app: {
    name: getOsEnv('APP_NAME'),
    port: normalizePort(process.env.PORT || getOsEnv('APP_PORT')),
    schema: getOsEnv('APP_SCHEMA'),
    host: getOsEnv('APP_HOST'),
    routePrefix: getOsEnv('APP_ROUTE_PREFIX'),
    banner: toBool(getOsEnv('APP_BANNER')),
    baseUrl: `${getOsEnv('APP_SCHEMA')}://${getOsEnv('APP_HOST')}${getOsEnvOptional('APP_PORT') ? `:${getOsEnv('APP_PORT')}` : ''}${getOsEnv('APP_ROUTE_PREFIX')}`,
    dirs: {
      entities: getOsPaths('TYPEORM_ENTITIES'),
      entitiesDir: getOsPath('TYPEORM_ENTITIES_DIR'),
      controllers: getOsPaths('TYPEORM_CONTROLLERS'),
      middlewares: getOsPaths('TYPEORM_MIDDLEWARES'),
    },
  },

  log: {
    level: getOsEnv('LOG_LEVEL'),
    json: toBool(getOsEnvOptional('LOG_JSON')),
    output: getOsEnv('LOG_OUTPUT'),
  },
  db: {
    enabled: toBool(getOsEnvOptional('MONGO_CONNECTION') || 'true'),
    DB_URL: getOsEnv('TYPEORM_DB_URL'),
  },
  redis: {
    enabled: toBool(getOsEnv('REDIS_ENABLED')),
    host: getOsEnv('REDIS_HOST'),
    port: toNumber(getOsEnv('REDIS_PORT')),
    password: getOsEnv('REDIS_PASSWORD'),
    db: toNumber(getOsEnv('REDIS_DB')),
    keyPrefix: getOsEnv('REDIS_KEY_PREFIX'),
    userName: getOsEnvOptional('REDIS_USERNAME'),
  },
  swagger: {
    enabled: toBool(getOsEnv('SWAGGER_ENABLED')),
    route: getOsEnv('SWAGGER_ROUTE'),
    username: getOsEnv('SWAGGER_USERNAME'),
    password: getOsEnv('SWAGGER_PASSWORD'),
    port: getOsEnvOptional('SWAGGER_PORT'),
    baseUrl: `${getOsEnv('SWAGGER_SCHEMA')}://${getOsEnv('SWAGGER_HOST')}${getOsEnvOptional('SWAGGER_PORT') ? `:${getOsEnv('SWAGGER_PORT')}` : ''}${getOsEnv('APP_ROUTE_PREFIX')}`,
  },
  awsApiGateway: {
    optionsHeaders: getOsEnv('AWS_API_GATEWAY_OPTIONS_HEADERS'),
    optionsOrigins: getOsEnvArray('AWS_API_GATEWAY_OPTIONS_ORIGINS'),
  },
  s3: {
    bucket: getOsEnvOptional('S3_BUCKET') || getOsEnvOptional('S3_BUCKET_NAME') || '',
    region: getOsEnvOptional('S3_REGION') || '',
    accessKeyId: getOsEnvOptional('S3_ACCESS_KEY_ID'),
    secretAccessKey: getOsEnvOptional('S3_SECRET_ACCESS_KEY'),
    endpoint: getOsEnvOptional('S3_ENDPOINT'),
    keyPrefix: getOsEnvOptional('S3_KEY_PREFIX'),
    forcePathStyle: toBool(getOsEnvOptional('S3_FORCE_PATH_STYLE') || 'false'),
  },
  frontend: {
    port: normalizePort(getOsEnv('FRONTEND_PORT')),
    schema: getOsEnv('FRONTEND_SCHEMA'),
    host: getOsEnv('FRONTEND_HOST'),
    baseUrl: `${getOsEnv('FRONTEND_SCHEMA')}://${getOsEnv('FRONTEND_HOST')}:${getOsEnv('FRONTEND_PORT')}`,
  },
  authCredentials: {
    xApiKey: getOsEnv('X_API_KEY'),
    clientId: getOsEnv('CLIENT_ID'),
    clientSecret: getOsEnv('CLIENT_SECRET'),
    tempPassword: getOsEnv('TEMP_PASSWORD'),
  },

  firebase: {
    projectId: getOsEnv('FIREBASE_PROJECT_ID'),
    clientEmail: getOsEnv('FIREBASE_CLIENT_EMAIL'),
    privateKey: getOsEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  },
  tokenSecret: getOsEnv('TOKEN_SECRET'),
  rsaPrivateKey: getOsEnv('RSA_PRIVATE_KEY'),
  rsaPublicKey: getOsEnv('RSA_PUBLIC_KEY'),
  deleteToken: toBool(getOsEnv('DELETE_TOKEN')),
  jwtSecret: getOsEnv('JWT_SECRET'),
  jwtExpiry: getOsEnv('JWT_EXPIRY'),
  cookie: {
    secure: toBool(getOsEnvOptional('COOKIE_SECURE') || 'false'),
    httpOnly: toBool(getOsEnvOptional('COOKIE_HTTP_ONLY') || 'true'),
    sameSite: (getOsEnvOptional('COOKIE_SAME_SITE') as 'strict' | 'lax' | 'none') || 'lax',
  },
};
