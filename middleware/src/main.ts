/**
 * Vizora Middleware API Server
 * Production-ready configuration
 */

import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { SanitizeInterceptor } from './modules/common/interceptors/sanitize.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
