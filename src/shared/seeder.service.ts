import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../modules/auth/entities/user.entity';
import { generateSystemCode } from '../common/utils/system-code-generator.util';
import { TaskStatusesService } from '../modules/task-statuses/task-statuses.service';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly taskStatusesService: TaskStatusesService,
  ) {}

  async onApplicationBootstrap() {
    // Verificar si las tablas existen
    const tablesReady = await this.ensureTablesExist();
    if (!tablesReady) {
      this.logger.warn(
        'No se pudo preparar la base de datos. Seeders omitidos.',
      );
      return;
    }

    await this.seedSuperAdmin();
    await this.seedGlobalTaskStatuses();
    await this.backfillSystemCodes();
  }

  /**
   * Verifica si las tablas necesarias existen.
   * @returns true si las tablas estan listas, false si hubo un error
   */
  private async ensureTablesExist(): Promise<boolean> {
    try {
      const tableExists = await this.checkTableExists('users');

      if (!tableExists) {
        this.logger.log(
          'Tablas no encontradas. Sincronizando esquema de base de datos...',
        );
        await this.dataSource.synchronize(false);
        this.logger.log('Esquema sincronizado correctamente.');
      }

      return true;
    } catch (error) {
      this.logger.error(
        'Error verificando/sincronizando tablas:',
        error.message,
      );
      return false;
    }
  }

  /**
   * Verifica si una tabla existe en la base de datos
   */
  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.dataSource.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )`,
        [tableName],
      );
      return result[0]?.exists === true;
    } catch {
      return false;
    }
  }

  /**
   * Crea el Super Admin por defecto si no existe
   */
  private async seedSuperAdmin(): Promise<void> {
    const superAdminEmail = this.configService.get<string>(
      'SUPER_ADMIN_EMAIL',
      'admin@taskhub.com',
    );
    const superAdminPassword = this.configService.get<string>(
      'SUPER_ADMIN_PASSWORD',
      'Admin123!',
    );

    const existingSuperAdmin = await this.userRepository.findOne({
      where: { email: superAdminEmail },
    });

    if (existingSuperAdmin) {
      this.logger.log(`Super Admin ya existe: ${superAdminEmail}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);

    const superAdmin = this.userRepository.create({
      email: superAdminEmail,
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+1234567890',
      roles: [UserRole.SUPER_ADMIN],
      emailVerified: true,
      isActive: true,
      isSystemUser: true,
    });

    await this.userRepository.save(superAdmin);
    this.logger.log(`Super Admin creado: ${superAdminEmail}`);
  }

  /**
   * Crea los task statuses globales para daily tasks
   */
  private async seedGlobalTaskStatuses(): Promise<void> {
    try {
      await this.taskStatusesService.createGlobalDefaults();
    } catch (error) {
      this.logger.warn(`Error creando task statuses globales: ${error.message}`);
    }
  }

  /**
   * Backfill: Genera systemCode para registros existentes que no lo tienen
   * Solo corre si hay registros sin codigo (no-op despues del primer run)
   */
  private async backfillSystemCodes(): Promise<void> {
    const entityTableMap: Array<{ entityName: string; tableName: string }> = [
      { entityName: 'User', tableName: 'users' },
      { entityName: 'Notification', tableName: 'notifications' },
    ];

    let totalBackfilled = 0;

    for (const { entityName, tableName } of entityTableMap) {
      try {
        const tableExists = await this.checkTableExists(tableName);
        if (!tableExists) continue;

        // Check if systemCode column exists
        const columnExists = await this.dataSource.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = 'systemCode'
          )`,
          [tableName],
        );
        if (!columnExists[0]?.exists) continue;

        const rows = await this.dataSource.query(
          `SELECT id FROM "${tableName}" WHERE "systemCode" IS NULL`,
        );

        if (rows.length === 0) continue;

        for (const row of rows) {
          const code = generateSystemCode(entityName);
          await this.dataSource.query(
            `UPDATE "${tableName}" SET "systemCode" = $1 WHERE id = $2`,
            [code, row.id],
          );
        }

        totalBackfilled += rows.length;
        this.logger.log(
          `Backfill: ${rows.length} registros de ${tableName} actualizados con systemCode`,
        );
      } catch (error) {
        this.logger.warn(
          `Backfill: Error procesando ${tableName}: ${error.message}`,
        );
      }
    }

    if (totalBackfilled > 0) {
      this.logger.log(
        `Backfill completado: ${totalBackfilled} registros actualizados`,
      );
    }
  }
}
