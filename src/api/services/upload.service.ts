import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpError, InternalServerError } from 'routing-controllers';
import { Service } from 'typedi';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../../env';
import { getS3Client } from '../../lib/aws/s3Client';

export type PresignedUrlResult = {
  presignedUrl: string;
  key: string;
  fileUrl: string;
};

export type UploadFileResult = {
  key: string;
  fileUrl: string;
};

@Service()
export class UploadService {
  public async generatePresignedUrl(
    fileName: string,
    fileType: string,
    folder: string = 'uploads',
  ): Promise<PresignedUrlResult> {
    try {
      if (!env.s3.bucket) {
        throw new InternalServerError('S3_BUCKET_NOT_CONFIGURED');
      }

      const ext = fileName.split('.').pop()?.toLowerCase();
      if (!ext) {
        throw new HttpError(400, 'INVALID_FILE_NAME');
      }

      const key = `${folder}/${uuidv4()}.${ext}`;
      const client = getS3Client();

      const command = new PutObjectCommand({
        Bucket: env.s3.bucket,
        Key: key,
        ContentType: fileType,
      });

      const presignedUrl = await getSignedUrl(client, command, { expiresIn: 900 });

      return {
        presignedUrl,
        key,
        fileUrl: `https://${env.s3.bucket}.s3.${env.s3.region}.amazonaws.com/${key}`,
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GENERATE_PRESIGNED_URL_FAILED');
    }
  }

  public async uploadFile(
    fileBuffer: Buffer,
    mimeType: string,
    originalName: string,
    folder: string = 'uploads',
  ): Promise<UploadFileResult> {
    try {
      if (!env.s3.bucket) {
        throw new InternalServerError('S3_BUCKET_NOT_CONFIGURED');
      }

      const ext = originalName.split('.').pop()?.toLowerCase() || 'bin';
      const key = `${folder}/${uuidv4()}.${ext}`;
      const client = getS3Client();

      await client.send(
        new PutObjectCommand({
          Bucket: env.s3.bucket,
          Key: key,
          Body: fileBuffer,
          ContentType: mimeType,
          ChecksumAlgorithm: undefined,
        }),
      );

      return {
        key,
        fileUrl: `https://${env.s3.bucket}.s3.${env.s3.region}.amazonaws.com/${key}`,
      };
    } catch (error) {
      console.error('[UploadService] uploadFile error:', error);
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('UPLOAD_FILE_FAILED');
    }
  }

  public async deleteFile(key: string): Promise<void> {
    try {
      if (!env.s3.bucket) {
        throw new InternalServerError('S3_BUCKET_NOT_CONFIGURED');
      }

      const client = getS3Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: env.s3.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('DELETE_FILE_FAILED');
    }
  }
}