import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { env } from '../../env';

let cachedClient: S3Client | null = null;

export const getS3Client = (): S3Client => {
  // ✅ Reset cache every time so new network/credentials are picked up
  cachedClient = null;

  if (cachedClient) {
    return cachedClient;
  }

  // Debug — remove after fix
  console.log('S3 credentials check:');
  console.log('accessKeyId:', process.env.AWS_ACCESS_KEY_ID);
  console.log('secretAccessKey length:', process.env.AWS_SECRET_ACCESS_KEY?.length);
  console.log('secretAccessKey last 4:', process.env.AWS_SECRET_ACCESS_KEY?.slice(-4));
  console.log('region:', process.env.AWS_REGION);

  const config: S3ClientConfig = {
    region: process.env.AWS_REGION || env.s3.region,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  };

  if (env.s3.endpoint) {
    config.endpoint = env.s3.endpoint;
    config.forcePathStyle = env.s3.forcePathStyle;
  }

  if (env.s3.accessKeyId && env.s3.secretAccessKey) {
    config.credentials = {
      accessKeyId: env.s3.accessKeyId,
      secretAccessKey: env.s3.secretAccessKey,
    };
  } else {
    // ← fallback to AWS_* env vars directly
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    };
  }

  cachedClient = new S3Client(config);
  return cachedClient;
};