/**
 * Vizora Middleware API Server
 * Production-ready configuration
 */

import 'dotenv/config';
import { initializeSentry } from './config/sentry.config';

// Initialize Sentry before NestJS bootstrap
initializeSentry();

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';
import { SanitizeInterceptor } from './modules/common/interceptors/sanitize.interceptor';
import { LoggingInterceptor } from './modules/common/interceptors/logging.interceptor';
import { ResponseEnvelopeInterceptor } from './modules/common/interceptors/response-envelope.interceptor';
import { SentryInterceptor } from './interceptors/sentry.interceptor';
import { AllExceptionsFilter } from './modules/common/filters/all-exceptions.filter';

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

  // Serve static files (thumbnails) with cache headers
  app.useStaticAssets(join(process.cwd(), 'static'), {
    prefix: '/static/',
    maxAge: '7d',
  });

  // Serve uploaded content files with long cache (hash-based filenames)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    maxAge: '30d',
    immutable: true,
  });

  // Response compression (gzip/brotli) — reduces API payload sizes by 60-80%
  app.use(compression({ threshold: 1024, level: 6 }));

  // Cookie parser (required for httpOnly cookie authentication)
  app.use(cookieParser());

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false, // Allow embedding for display clients
  }));

  // CORS configuration - staging mirrors production restrictions
  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || [];
  const isRestrictedEnv = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';
  app.enableCors({
    origin: isRestrictedEnv
      ? corsOrigins
      : true, // Allow all in development
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  });

  // Global exception filter — catches all unhandled exceptions
  app.useGlobalFilters(new AllExceptionsFilter());

  // HTTP request timeout middleware
  app.use((req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
    // File uploads get a longer timeout (120s), everything else gets 30s
    const isUpload = req.path.includes('/content/upload') || req.method === 'POST' && req.headers['content-type']?.includes('multipart');
    req.setTimeout(isUpload ? 120000 : 30000);
    next();
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
  // Order matters: logging first, then Sentry error tracking, then sanitization, then envelope
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new SentryInterceptor(),
    new SanitizeInterceptor(reflector),
    new ResponseEnvelopeInterceptor(reflector),
  );

  const globalPrefix = 'api/v1';
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
    // Signal PM2 that the app is ready to accept traffic
    if (typeof process.send === 'function') {
      process.send('ready');
    }
    Logger.log(`🚀 Middleware API running on: http://localhost:${port}/${globalPrefix}`);
    Logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    Logger.log(`⚠️  Port ${port} is RESERVED for Middleware - will not start if occupied`);

    // Warn about default credentials in non-development environments
    if (process.env.NODE_ENV !== 'development') {
      const minioAccessKey = process.env.MINIO_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '';
      const minioSecretKey = process.env.MINIO_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';
      if (minioAccessKey === 'minioadmin' || minioSecretKey === 'minioadmin') {
        Logger.warn('WARNING: MinIO is using default credentials (minioadmin). Change these for production use.');
      }

      const dbUrl = process.env.DATABASE_URL || '';
      if (dbUrl.includes('postgres:postgres')) {
        Logger.warn('WARNING: DATABASE_URL contains default PostgreSQL credentials (postgres:postgres). Change these for production use.');
      }
    }
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

// Catch unhandled rejections — log but don't exit; let PM2 handle restarts if needed
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  Logger.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});
