import { Module, Logger, Global, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

export function resolveTypeOrmSynchronize(environment: {
  NODE_ENV?: string;
}): boolean {
  return environment.NODE_ENV !== 'production';
}

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
        const nodeEnv = configService.get<string>('NODE_ENV');
        const shouldSync = resolveTypeOrmSynchronize({ NODE_ENV: nodeEnv });

        const dbConfig = {
          type: 'postgres' as const,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_NAME', 'modular_base'),
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          synchronize: shouldSync,
          logging: nodeEnv === 'development',
          retryAttempts: 3,
          retryDelay: 3000,
        };

        if (nodeEnv === 'production') {
          logger.log(
            'TypeORM synchronize disabled in production; use explicit pre-deploy migrations.',
          );
        }

        logger.log('🔄 Intentando conectar a PostgreSQL...');
        logger.log(`📍 Host: ${dbConfig.host}:${dbConfig.port}`);
        logger.log(`📊 Database: ${dbConfig.database}`);

        return dbConfig;
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule implements OnModuleInit {
  private static readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly dataSource: DataSource) {
    DatabaseModule.logger.log('💾 DatabaseModule inicializado');
    DatabaseModule.logger.log('🔧 PostgreSQL configurado');
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
