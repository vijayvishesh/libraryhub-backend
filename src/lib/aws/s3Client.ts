import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { env } from '../../env';

let cachedClient: S3Client | null = null;

export const getS3Client = (): S3Client => {
  if (cachedClient) {
    return cachedClient;
  }

  const config: S3ClientConfig = {
    region: env.s3.region,
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
  }

  cachedClient = new S3Client(config);
  return cachedClient;
};
