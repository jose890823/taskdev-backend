import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración para copiar datos de tasks.assignedToId a la tabla task_assignees.
 *
 * Con synchronize:true en dev, la tabla task_assignees ya existe.
 * Esta migración solo copia datos existentes del campo legacy.
 */
export class MigrateAssignedToTaskAssignees1739900000000 implements MigrationInterface {
  name = 'MigrateAssignedToTaskAssignees1739900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('task_assignees');

    if (!hasTable) {
      console.log('⚠️ Tabla task_assignees no existe. Reinicia el backend con synchronize:true primero.');
      return;
    }

    // Insert assignees from legacy field where not already in task_assignees
    const result = await queryRunner.query(`
      INSERT INTO "task_assignees" ("id", "taskId", "userId", "createdAt")
      SELECT
        gen_random_uuid(),
        t."id",
        t."assignedToId",
        NOW()
      FROM "tasks" t
      WHERE t."assignedToId" IS NOT NULL
        AND t."deletedAt" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "task_assignees" ta
          WHERE ta."taskId" = t."id" AND ta."userId" = t."assignedToId"
        )
    `);

    const count = Array.isArray(result) ? result.length : (result?.rowCount || 0);
    console.log(`✅ Migración completada: ${count} asignaciones copiadas a task_assignees`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: no eliminamos datos de task_assignees ya que pueden haber sido modificados
    console.log('ℹ️ Rollback no aplica para esta migración');
  }
}
