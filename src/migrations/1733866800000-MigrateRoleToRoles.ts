import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración para convertir el campo 'role' (string único) a 'roles' (array de strings)
 *
 * Esta migración:
 * 1. Crea la columna 'roles' si no existe
 * 2. Copia los valores de 'role' a 'roles' (como array)
 * 3. Elimina la columna 'role' antigua
 *
 * NOTA: En desarrollo con synchronize:true, la columna 'roles' ya debería existir.
 * Esta migración solo es necesaria para migrar datos existentes.
 */
export class MigrateRoleToRoles1733866800000 implements MigrationInterface {
  name = 'MigrateRoleToRoles1733866800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si la columna 'role' existe (datos legacy)
    const hasRoleColumn = await queryRunner.hasColumn('users', 'role');
    const hasRolesColumn = await queryRunner.hasColumn('users', 'roles');

    if (hasRoleColumn && !hasRolesColumn) {
      // Crear la columna 'roles'
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN "roles" text DEFAULT 'client'
      `);

      // Migrar datos de 'role' a 'roles'
      await queryRunner.query(`
        UPDATE "users" SET "roles" = "role"
      `);

      // Eliminar la columna 'role'
      await queryRunner.query(`
        ALTER TABLE "users" DROP COLUMN "role"
      `);

      console.log('✅ Migración completada: role -> roles');
    } else if (hasRoleColumn && hasRolesColumn) {
      // Ambas columnas existen, migrar datos donde roles esté vacío
      await queryRunner.query(`
        UPDATE "users"
        SET "roles" = "role"
        WHERE "roles" IS NULL OR "roles" = ''
      `);

      // Eliminar la columna 'role'
      await queryRunner.query(`
        ALTER TABLE "users" DROP COLUMN "role"
      `);

      console.log('✅ Datos migrados y columna role eliminada');
    } else if (!hasRoleColumn && hasRolesColumn) {
      console.log('ℹ️ La migración ya fue aplicada (solo existe roles)');
    } else {
      console.log('⚠️ No se encontraron columnas role ni roles');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir: crear 'role' desde 'roles'
    const hasRolesColumn = await queryRunner.hasColumn('users', 'roles');
    const hasRoleColumn = await queryRunner.hasColumn('users', 'role');

    if (hasRolesColumn && !hasRoleColumn) {
      // Crear la columna 'role'
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN "role" varchar(50) DEFAULT 'client'
      `);

      // Migrar datos: tomar el primer rol del array
      await queryRunner.query(`
        UPDATE "users" SET "role" = SPLIT_PART("roles", ',', 1)
      `);

      console.log('✅ Rollback completado: roles -> role');
    }
  }
}
