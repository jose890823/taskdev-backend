import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('legacy seed script safety', () => {
  const seedPath = resolve(process.cwd(), 'seed-data.js');

  it('fails before connecting when no explicit database name is supplied', () => {
    const result = spawnSync(process.execPath, [seedPath], {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH ?? '/usr/bin:/bin' },
      encoding: 'utf8',
    });
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain(
      'Legacy seed script is not part of the current TaskHub seed flow',
    );
    expect(output).not.toContain('Connecting to PostgreSQL');
  });

  it('has no database-name fallback in the legacy script', () => {
    const source = readFileSync(seedPath, 'utf8');

    expect(source).toContain("getRequiredSeedEnv('SEED_DATABASE_NAME')");
    expect(source).not.toContain("database: 'taskdev_db'");
    expect(source).not.toContain('Bohophy123!');
    expect(source).toContain("getRequiredSeedEnv('SEED_USER_PASSWORD')");
  });
});
