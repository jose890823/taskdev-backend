import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as express from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // ============================================
  // SEGURIDAD - Helmet (HTTP Headers)
  // ============================================
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Configurar limite de tamano para body parser
  app.useBodyParser('json', { limit: '50mb' });
  app.useBodyParser('urlencoded', { limit: '50mb', extended: true } as any);

  // Configurar servicio de archivos estaticos para uploads
  app.use('/uploads', express.static('uploads'));

  // Configurar prefijo global
  app.setGlobalPrefix('api');

  // Configurar validation pipe global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ============================================
  // SEGURIDAD - CORS (Cross-Origin Resource Sharing)
  // ============================================
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
  ];

  // Produccion: agregar origenes desde CORS_ORIGIN (comma-separated)
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    corsOrigin.split(',').forEach(o => {
      const trimmed = o.trim();
      if (trimmed) allowedOrigins.push(trimmed);
    });
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // En desarrollo, permitir cualquier localhost
      if (
        process.env.NODE_ENV === 'development' &&
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }

      logger.warn(`CORS bloqueado para origen: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
    credentials: true,
    maxAge: 86400,
  });

  // Configurar Swagger
  const config = new DocumentBuilder()
    .setTitle('TaskHub API')
    .setDescription('API de TaskHub - Gestion de Tareas y Proyectos')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Autenticacion y autorizacion')
    .addTag('Users', 'Gestion de usuarios')
    .addTag('Users - Profile', 'Perfil de usuario')
    .addTag('Users - Admin', 'Administracion de usuarios')
    .addTag('Security - Admin', 'Panel de seguridad (Super Admin)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'TaskHub API Docs',
    customfavIcon: '/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  logger.log(`Aplicacion corriendo en: http://localhost:${port}`);
  logger.log(`Documentacion Swagger en: http://localhost:${port}/api/docs`);
  logger.log(`Seguridad activada: Helmet, CORS, Rate Limiting`);
}

bootstrap().catch((error) => {
  console.error('Error iniciando la aplicacion:', error);
  process.exit(1);
});
