import * as crypto from 'crypto';
import { env } from '../../env';

const privateKey = env.rsaPrivateKey?.replace(/\\n/g, '\n') || '';

export function decrypt(encryptedText: string): string {
  return crypto
    .privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encryptedText, 'base64'),
    )
    .toString('utf-8');
}
