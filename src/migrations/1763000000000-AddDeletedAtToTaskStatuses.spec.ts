import { AddDeletedAtToTaskStatuses1763000000000 } from './1763000000000-AddDeletedAtToTaskStatuses';

describe('AddDeletedAtToTaskStatuses migration', () => {
  it('adds the nullable soft-delete column idempotently', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new AddDeletedAtToTaskStatuses1763000000000();

    await migration.up({ query } as never);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toBe(
      'ALTER TABLE "task_statuses" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP',
    );
  });

  it('drops the column on revert', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    const migration = new AddDeletedAtToTaskStatuses1763000000000();

    await migration.down({ query } as never);

    expect(query.mock.calls[0][0]).toBe(
      'ALTER TABLE "task_statuses" DROP COLUMN IF EXISTS "deletedAt"',
    );
  });
});
