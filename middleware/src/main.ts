/**
 * Vizora Middleware API Server
 * Production-ready configuration
 */

import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { SanitizeInterceptor } from './modules/common/interceptors/sanitize.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files (thumbnails)
  app.useStaticAssets(join(__dirname, '..', 'static'), {
    prefix: '/static/',
  });

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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

  // Global input sanitization (XSS protection)
  app.useGlobalInterceptors(new SanitizeInterceptor());

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

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
