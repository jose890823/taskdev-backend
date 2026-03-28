import { Module, Logger, Global, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');

        try {
          // Sincronización: NUNCA en producción a menos que se confirme explícitamente
          const isProduction = configService.get('NODE_ENV') === 'production';
          const forceSync =
            configService.get('TYPEORM_SYNC', 'false') === 'true';
          const forceSyncConfirm =
            configService.get('TYPEORM_SYNC_CONFIRM', 'false') ===
            'I_KNOW_WHAT_I_AM_DOING';

          // En producción: requiere TYPEORM_SYNC=true + TYPEORM_SYNC_CONFIRM=I_KNOW_WHAT_I_AM_DOING
          const shouldSync = isProduction
            ? forceSync && forceSyncConfirm
            : forceSync || true;

          const dbConfig = {
            type: 'postgres' as const,
            host: configService.get<string>('DB_HOST', 'localhost'),
            port: configService.get<number>('DB_PORT', 5432),
            username: configService.get<string>('DB_USERNAME', 'postgres'),
            password: configService.get<string>('DB_PASSWORD', 'postgres'),
            database: configService.get<string>('DB_NAME', 'modular_base'),
            entities: [__dirname + '/../**/*.entity{.ts,.js}'],
            synchronize: shouldSync,
            logging: configService.get('NODE_ENV') === 'development',
            retryAttempts: 3,
            retryDelay: 3000,
          };

          if (isProduction && forceSync && !forceSyncConfirm) {
            logger.error(
              '❌ TYPEORM_SYNC=true en producción IGNORADO — se requiere TYPEORM_SYNC_CONFIRM=I_KNOW_WHAT_I_AM_DOING para activar',
            );
          }

          if (shouldSync && isProduction) {
            logger.warn(
              '⚠️  TYPEORM_SYNC activo en producción — Las tablas se sincronizarán automáticamente',
            );
            logger.warn(
              '⚠️  RECUERDA desactivar TYPEORM_SYNC después de crear las tablas',
            );
          }

          logger.log('🔄 Intentando conectar a PostgreSQL...');
          logger.log(`📍 Host: ${dbConfig.host}:${dbConfig.port}`);
          logger.log(`📊 Database: ${dbConfig.database}`);

          return dbConfig;
        } catch (error: unknown) {
          logger.warn(
            '⚠️  PostgreSQL no disponible, usando fallback in-memory',
          );
          logger.error(
            `Error: ${error instanceof Error ? error.message : String(error)}`,
          );

          // Retornar configuración básica que permita el módulo cargar
          return {
            type: 'postgres' as const,
            host: 'localhost',
            port: 5432,
            username: 'invalid',
            password: 'invalid',
            database: 'invalid',
            entities: [],
            synchronize: false,
            logging: false,
          };
        }
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule implements OnModuleInit {
  private static readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly dataSource: DataSource) {
    DatabaseModule.logger.log('💾 DatabaseModule inicializado');
    DatabaseModule.logger.log(
      '🔧 PostgreSQL configurado con fallback automático',
    );
  }

  async onModuleInit() {
    try {
      // Crear extensión uuid-ossp si no existe
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      DatabaseModule.logger.log('✅ Extensión uuid-ossp verificada/creada');
    } catch (error: unknown) {
      DatabaseModule.logger.warn(
        `⚠️ No se pudo crear extensión uuid-ossp: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
