import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import * as dotenv from 'dotenv';
import * as path from 'path';

const ENV_FILE = `.env${process.env.NODE_ENV === 'test' ? '.test' : ''}`;

const toStringValue = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
};

const loadDotEnv = (): void => {
  dotenv.config({
    path: path.join(process.cwd(), ENV_FILE),
  });
};

const shouldUseAwsSecrets = (): boolean => {
  const flag = process.env.USE_AWS_SECRETS;
  if (flag !== undefined) {
    return flag === 'true';
  }
  return Boolean(process.env.AWS_SECRETS_NAMES || process.env.AWS_SECRETS_NAME);
};

const resolveAwsRegion = (): string => {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  if (!region) {
    throw new Error('AWS region is required (AWS_REGION or AWS_DEFAULT_REGION)');
  }
  return region;
};

const resolveSecretIds = (): string[] => {
  const list = process.env.AWS_SECRETS_NAMES || process.env.AWS_SECRETS_NAME;
  if (!list) {
    throw new Error('AWS secret name(s) required (AWS_SECRETS_NAMES or AWS_SECRETS_NAME)');
  }
  return list
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

const applySecretsToEnv = (payload: string): void => {
  const parsed = JSON.parse(payload) as Record<string, unknown>;
  Object.entries(parsed).forEach(([key, value]) => {
    const stringValue = toStringValue(value);
    if (stringValue !== undefined) {
      process.env[key] = stringValue;
    }
  });
};

const loadAwsSecrets = async (): Promise<void> => {
  const client = new SecretsManagerClient({ region: resolveAwsRegion() });
  const secretIds = resolveSecretIds();

  for (const secretId of secretIds) {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    if (result.SecretString) {
      applySecretsToEnv(result.SecretString);
      continue;
    }
    if (result.SecretBinary) {
      const decoded = Buffer.from(result.SecretBinary).toString('utf8');
      applySecretsToEnv(decoded);
      continue;
    }
    throw new Error(`AWS secret is empty: ${secretId}`);
  }
};

export const initEnv = async (): Promise<void> => {
  loadDotEnv();
  if (!shouldUseAwsSecrets()) {
    return;
  }
  await loadAwsSecrets();
};
