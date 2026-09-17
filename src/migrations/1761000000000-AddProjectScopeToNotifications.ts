import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectScopeToNotifications1761000000000 implements MigrationInterface {
  name = 'AddProjectScopeToNotifications1761000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "notifications" ADD COLUMN "projectId" uuid',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_notifications_project_user_read" ON "notifications" ("projectId", "userId", "isRead")',
    );
    await queryRunner.query(
      'ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_project"',
    );
    await queryRunner.query('DROP INDEX "IDX_notifications_project_user_read"');
    await queryRunner.query(
      'ALTER TABLE "notifications" DROP COLUMN "projectId"',
    );
  }
}
