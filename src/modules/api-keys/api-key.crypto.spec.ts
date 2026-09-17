import {
  API_KEY_PREFIX,
  API_KEY_SECRET_BYTES,
  API_KEY_PUBLIC_ID_BYTES,
  API_KEY_HASH_VERSION,
  API_KEY_PREVIOUS_HASH_VERSION,
} from './api-key.constants';
import {
  generateApiKey,
  hashApiKeySecret,
  parseApiKey,
  redactApiKey,
  verifyApiKeySecret,
} from './api-key.crypto';

describe('API-key cryptography', () => {
  it('generates an opaque key with independent CSPRNG components', () => {
    const first = generateApiKey('test-pepper');
    const second = generateApiKey('test-pepper');

    expect(first.token).toBe(
      `${API_KEY_PREFIX}${first.publicId}_${first.secret}`,
    );
    expect(Buffer.from(first.publicId, 'hex')).toHaveLength(
      API_KEY_PUBLIC_ID_BYTES,
    );
    expect(Buffer.from(first.secret, 'hex')).toHaveLength(API_KEY_SECRET_BYTES);
    expect(second.token).not.toBe(first.token);
    expect(first.prefix).toBe(`${API_KEY_PREFIX}${first.publicId.slice(0, 8)}`);
  });

  it('accepts the current verifier and one versioned previous verifier only', () => {
    const secret = 'secret-for-verification';
    const current = hashApiKeySecret(
      secret,
      API_KEY_HASH_VERSION,
      'current-pepper',
    );
    const previous = hashApiKeySecret(
      secret,
      API_KEY_PREVIOUS_HASH_VERSION,
      'previous-pepper',
    );

    expect(
      verifyApiKeySecret(secret, current, API_KEY_HASH_VERSION, {
        [API_KEY_HASH_VERSION]: 'current-pepper',
        [API_KEY_PREVIOUS_HASH_VERSION]: 'previous-pepper',
      }),
    ).toBe(true);
    expect(
      verifyApiKeySecret(secret, previous, API_KEY_PREVIOUS_HASH_VERSION, {
        [API_KEY_HASH_VERSION]: 'current-pepper',
        [API_KEY_PREVIOUS_HASH_VERSION]: 'previous-pepper',
      }),
    ).toBe(true);
    expect(
      verifyApiKeySecret(secret, previous, API_KEY_PREVIOUS_HASH_VERSION, {
        [API_KEY_HASH_VERSION]: 'current-pepper',
      }),
    ).toBe(false);
  });

  it('parses and redacts credentials without exposing secret material', () => {
    const generated = generateApiKey('test-pepper');
    const parsed = parseApiKey(generated.token);

    expect(parsed).toEqual({
      publicId: generated.publicId,
      secret: generated.secret,
    });
    expect(redactApiKey(generated.token)).toBe(
      `${API_KEY_PREFIX}${generated.publicId.slice(0, 8)}…`,
    );
    expect(redactApiKey(generated.token)).not.toContain(generated.secret);
    expect(parseApiKey('Bearer not-an-api-key')).toBeNull();
  });

  it('fails closed when a verifier pepper is missing', () => {
    expect(() => generateApiKey('')).toThrow('API-key pepper is required');
    expect(verifyApiKeySecret('secret', '00', 1, { 1: undefined })).toBe(false);
  });

  it('fails closed for an unknown pepper version', () => {
    const verifier = hashApiKeySecret('secret', 99, 'unexpected-pepper');

    expect(
      verifyApiKeySecret('secret', verifier, 99, {
        1: 'current-pepper',
        0: 'previous-pepper',
      }),
    ).toBe(false);
  });
});
