import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaskAiUsageExecutions1762000000000 implements MigrationInterface {
  name = 'CreateTaskAiUsageExecutions1762000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`
      CREATE TYPE "task_ai_usage_status_enum" AS ENUM (
        'recorded', 'not_registered', 'partial', 'not_applicable'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "task_ai_usage_executions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "taskId" uuid NOT NULL,
        "provider" character varying(100),
        "model" character varying(200),
        "source" character varying(100),
        "executionId" character varying(255),
        "inputTokens" bigint,
        "outputTokens" bigint,
        "totalTokens" bigint,
        "status" "task_ai_usage_status_enum" NOT NULL,
        "reasonCode" character varying(100),
        "reason" character varying(500),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_ai_usage_executions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_task_ai_usage_executions_task" FOREIGN KEY ("taskId")
          REFERENCES "tasks"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_task_ai_usage_executions_task_created" ON "task_ai_usage_executions" ("taskId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_task_ai_usage_executions_task_execution" ON "task_ai_usage_executions" ("taskId", "executionId") WHERE "executionId" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_task_ai_usage_executions_task_execution"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_task_ai_usage_executions_task_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "task_ai_usage_executions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "task_ai_usage_status_enum"`);
  }
}
