import { generateApiKey } from './api-key.crypto';
import {
  sanitizeApiKeyAuditMetadata,
  sanitizeApiKeyReason,
} from './api-key.policy';

describe('API-key audit policy', () => {
  it('redacts raw API keys from revoke reasons and bounds the result', () => {
    const generated = generateApiKey('test-pepper');
    const reason = sanitizeApiKeyReason(
      `compromised ${generated.token} https://example.test/revoke?token=${generated.secret}`,
    );

    expect(reason).not.toContain(generated.token);
    expect(reason).not.toContain(generated.secret);
    expect(reason).not.toContain('example.test');
    expect(reason).toContain('[api-key]');
    expect(reason.length).toBeLessThanOrEqual(128);
  });

  it('keeps only bounded allowlisted audit metadata and strips URL queries', () => {
    const metadata = sanitizeApiKeyAuditMetadata({
      keyId: 'key-1',
      reason: 'retired https://example.test/path?token=secret',
      huge: 'not allowed',
      endpoint: '/api/tasks?projectId=secret',
      requiredScopes: Array.from({ length: 10 }, () => 'tasks:read'),
    });

    expect(metadata).toEqual({
      keyId: 'key-1',
      reason: 'retired [url]',
      requiredScopes: Array.from({ length: 6 }, () => 'tasks:read'),
    });
    expect(metadata.huge).toBeUndefined();
    expect(metadata.endpoint).toBeUndefined();
  });
});
