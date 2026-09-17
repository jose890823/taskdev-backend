import {
  API_KEY_SCOPES,
  DEFAULT_API_KEY_SCOPES,
  MAX_API_KEY_SCOPES,
  API_KEY_LIMITS,
} from './api-key.constants';
import {
  sanitizeApiKeyAuditMetadata,
  isProjectBindingAllowed,
  sanitizeApiKeyMetadata,
} from './api-key.policy';

describe('API-key policy', () => {
  it('exposes only the approved scope catalog and limits', () => {
    expect(DEFAULT_API_KEY_SCOPES).toEqual(['tasks:read']);
    expect(API_KEY_SCOPES).toContain('project-members:write');
    expect(API_KEY_SCOPES).not.toContain('*');
    expect(MAX_API_KEY_SCOPES).toBe(6);
    expect(API_KEY_LIMITS).toMatchObject({
      maxActivePerUser: 10,
      maxActivePerUserProject: 3,
      maxActivePerProject: 50,
      requestsPerMinutePerKey: 60,
    });
  });

  it('allows exactly one matching project and denies missing or ambiguous context', () => {
    expect(isProjectBindingAllowed('project-a', ['project-a'])).toBe(true);
    expect(isProjectBindingAllowed('project-a', ['project-b'])).toBe(false);
    expect(isProjectBindingAllowed('project-a', [])).toBe(false);
    expect(
      isProjectBindingAllowed('project-a', ['project-a', 'project-b']),
    ).toBe(false);
  });

  it('returns metadata without verifier, secret, pepper, or authorization values', () => {
    const safe = sanitizeApiKeyMetadata({
      id: 'key-id',
      ownerId: 'owner-id',
      projectId: 'project-id',
      name: 'Automation',
      publicId: 'public-id',
      prefix: 'thk_public',
      verifier: 'verifier-value',
      secret: 'thk_public_secret',
      pepper: 'pepper-value',
      authorization: 'Bearer thk_public_secret',
    });

    expect(safe).toEqual({
      id: 'key-id',
      ownerId: 'owner-id',
      projectId: 'project-id',
      name: 'Automation',
      publicId: 'public-id',
      prefix: 'thk_public',
    });
    expect(JSON.stringify(safe)).not.toMatch(/verifier|secret|pepper|Bearer/i);
  });

  it('bounds audit metadata and removes URL/query-bearing reasons', () => {
    const safe = sanitizeApiKeyAuditMetadata({
      reason: 'retired https://example.test/revoke?secret=raw-secret',
      endpoint: '/api/tasks?projectId=project-a',
      keyId: 'key-id',
      rawBody: { secret: 'raw-secret' },
    });

    expect(safe).toEqual({
      reason: 'retired [url]',
      keyId: 'key-id',
    });
    expect(JSON.stringify(safe)).not.toContain('raw-secret');
    expect(JSON.stringify(safe)).not.toContain('example.test');
  });
});
