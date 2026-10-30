import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * TaskStatus gained @DeleteDateColumn in c226061 without a migration.
 * Dev databases already have it via synchronize, hence IF NOT EXISTS.
 */
export class AddDeletedAtToTaskStatuses1763000000000 implements MigrationInterface {
  name = 'AddDeletedAtToTaskStatuses1763000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "task_statuses" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "task_statuses" DROP COLUMN IF EXISTS "deletedAt"',
    );
  }
}
