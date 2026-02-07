/**
 * Vizora Middleware API Server
 * Production-ready configuration
 */

import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';
import { SanitizeInterceptor } from './modules/common/interceptors/sanitize.interceptor';
import { LoggingInterceptor } from './modules/common/interceptors/logging.interceptor';

async function bootstrap() {
  // Validate required production environment variables
  if (process.env.NODE_ENV === 'production') {
    const required = ['API_BASE_URL', 'CORS_ORIGIN', 'DATABASE_URL', 'JWT_SECRET', 'DEVICE_JWT_SECRET'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      Logger.error(`❌ Missing required production env vars: ${missing.join(', ')}`);
      Logger.error('Set these in your .env or deployment config before starting in production.');
      process.exit(1);
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files (thumbnails) — process.cwd() ensures consistency
  // with ThumbnailService which writes to the same base directory
  app.useStaticAssets(join(process.cwd(), 'static'), {
    prefix: '/static/',
  });

  // Serve uploaded content files
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Cookie parser (required for httpOnly cookie authentication)
  app.use(cookieParser());

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false, // Allow embedding for display clients
  }));

  // CORS configuration
  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || [];
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? corsOrigins
      : true, // Allow all in development
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // Disable detailed errors in production
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  // Global interceptors
  // Order matters: logging first, then sanitization
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new SanitizeInterceptor(),
  );

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Swagger API Documentation (only in development)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Vizora API')
      .setDescription('Digital Signage Management Platform API')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addCookieAuth('vizora_auth_token', {
        type: 'apiKey',
        in: 'cookie',
        name: 'vizora_auth_token',
      })
      .addTag('auth', 'Authentication endpoints')
      .addTag('displays', 'Display device management')
      .addTag('content', 'Content management')
      .addTag('playlists', 'Playlist management')
      .addTag('schedules', 'Schedule management')
      .addTag('organizations', 'Organization management')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    Logger.log(`📚 API Documentation available at: http://localhost:3000/${globalPrefix}/docs`);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  // STRICT PORT ENFORCEMENT - Middleware MUST use port 3000
  const port = 3000;
  const assignedPort = process.env.MIDDLEWARE_PORT || process.env.PORT;
  
  if (assignedPort && parseInt(assignedPort) !== port) {
    Logger.error(`❌ CONFIGURATION ERROR: Middleware must use port ${port}, not ${assignedPort}`);
    Logger.error(`Update .env: MIDDLEWARE_PORT=${port}`);
    process.exit(1);
  }

  try {
    await app.listen(port, '0.0.0.0');
    Logger.log(`🚀 Middleware API running on: http://localhost:${port}/${globalPrefix}`);
    Logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    Logger.log(`⚠️  Port ${port} is RESERVED for Middleware - will not start if occupied`);
  } catch (error) {
    Logger.error(`❌ FATAL: Cannot bind to port ${port}`);
    Logger.error(`Another process is using port ${port}. Stop it first.`);
    Logger.error(`Run: netstat -ano | findstr :${port}`);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  Logger.error('💥 Fatal error during bootstrap:', err);
  process.exit(1);
});

// Catch unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  Logger.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});
