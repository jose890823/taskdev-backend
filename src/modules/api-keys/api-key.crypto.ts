import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  API_KEY_HASH_ALGORITHM,
  API_KEY_PREFIX,
  API_KEY_PUBLIC_ID_BYTES,
  API_KEY_SECRET_BYTES,
} from './api-key.constants';

export interface GeneratedApiKey {
  token: string;
  publicId: string;
  prefix: string;
  secret: string;
  verifier: string;
}

export interface ParsedApiKey {
  publicId: string;
  secret: string;
}

export function generateApiKey(
  pepper: string,
  hashVersion = 1,
): GeneratedApiKey {
  if (!pepper) throw new Error('API-key pepper is required');

  const publicId = randomBytes(API_KEY_PUBLIC_ID_BYTES).toString('hex');
  const secret = randomBytes(API_KEY_SECRET_BYTES).toString('hex');

  return {
    token: `${API_KEY_PREFIX}${publicId}_${secret}`,
    publicId,
    prefix: `${API_KEY_PREFIX}${publicId.slice(0, 8)}`,
    secret,
    verifier: hashApiKeySecret(secret, hashVersion, pepper),
  };
}

export function parseApiKey(token: string): ParsedApiKey | null {
  if (!token.startsWith(API_KEY_PREFIX)) return null;

  const parts = token.slice(API_KEY_PREFIX.length).split('_');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  try {
    if (
      !/^[a-f0-9]+$/i.test(parts[0]) ||
      !/^[a-f0-9]+$/i.test(parts[1]) ||
      Buffer.from(parts[0], 'hex').length !== API_KEY_PUBLIC_ID_BYTES ||
      Buffer.from(parts[1], 'hex').length !== API_KEY_SECRET_BYTES
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return { publicId: parts[0], secret: parts[1] };
}

export function hashApiKeySecret(
  secret: string,
  hashVersion: number,
  pepper: string,
): string {
  return createHmac(API_KEY_HASH_ALGORITHM, secret)
    .update(`${hashVersion}:${pepper}`)
    .digest('hex');
}

export function verifyApiKeySecret(
  secret: string,
  expectedVerifier: string,
  hashVersion: number,
  peppers: Record<number, string | undefined>,
): boolean {
  const pepper = peppers[hashVersion];
  if (!pepper || !expectedVerifier) return false;

  const actual = hashApiKeySecret(secret, hashVersion, pepper);
  const expected = Buffer.from(expectedVerifier, 'hex');
  const received = Buffer.from(actual, 'hex');
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export function redactApiKey(token: string): string {
  const parsed = parseApiKey(token);
  return parsed ? `${API_KEY_PREFIX}${parsed.publicId.slice(0, 8)}…` : 'thk_…';
}
