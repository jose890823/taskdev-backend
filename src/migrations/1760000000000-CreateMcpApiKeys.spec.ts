import { CreateMcpApiKeys1760000000000 } from './1760000000000-CreateMcpApiKeys';
import dataSource from '../data-source';

describe('CreateMcpApiKeys migration', () => {
  it('creates uuid-ossp before using uuid_generate_v4', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new CreateMcpApiKeys1760000000000();

    await migration.up({ query } as never);

    expect(query.mock.calls[0][0]).toBe(
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
    );
    expect(query.mock.calls[1][0]).toContain('uuid_generate_v4()');
  });

  it('creates the additive table with binding, lifecycle, and lookup constraints', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new CreateMcpApiKeys1760000000000();

    await migration.up({ query } as never);

    const statements = query.mock.calls.map(([sql]) => sql as string);
    expect(statements[1]).toEqual(
      expect.stringContaining('"ownerId" uuid NOT NULL'),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining('"projectId" uuid NOT NULL'),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining('"scopes" text[] NOT NULL'),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining('"expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL'),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining('UNIQUE ("publicId")'),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining('REFERENCES "users"("id") ON DELETE CASCADE'),
    );
    expect(statements[1]).toEqual(
      expect.stringContaining('REFERENCES "projects"("id") ON DELETE RESTRICT'),
    );
    expect(statements[2]).toContain('"ownerId", "projectId"');
    expect(statements[3]).toContain('"projectId", "revokedAt"');
  });

  it('keeps the compiled production data source migration-only', () => {
    expect(dataSource.options.synchronize).toBe(false);
    expect(dataSource.options.migrationsRun).not.toBe(true);
    expect(dataSource.options.migrations).toEqual(
      expect.arrayContaining([expect.stringContaining('/migrations/*')]),
    );
  });

  it('does not destructively revert additive API-key data', async () => {
    const query = jest.fn();
    const migration = new CreateMcpApiKeys1760000000000();

    await migration.down({ query } as never);

    expect(query).not.toHaveBeenCalled();
  });
});
