/**
 * Vizora Middleware API Server
 * Production-ready configuration
 */

import 'dotenv/config';

// Global BigInt serialization support — Prisma BigInt fields crash JSON.stringify without this
// eslint-disable-next-line no-extend-native
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

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
import * as Sentry from '@sentry/nestjs';
import { AppModule } from './app/app.module';
import { SanitizeInterceptor } from './modules/common/interceptors/sanitize.interceptor';
import { LoggingInterceptor } from './modules/common/interceptors/logging.interceptor';
import { ResponseEnvelopeInterceptor } from './modules/common/interceptors/response-envelope.interceptor';
import { SentryInterceptor } from './interceptors/sentry.interceptor';
import { AllExceptionsFilter } from './modules/common/filters/all-exceptions.filter';
import {
  createCorsDelegate,
  isDeviceContentPath,
  isNullOriginCorsEnabled,
} from './common/cors/cors-policy';

async function bootstrap() {
  // Validate required production environment variables
  if (process.env.NODE_ENV === 'production') {
    const required = ['API_BASE_URL', 'CORS_ORIGIN', 'DATABASE_URL', 'JWT_SECRET', 'DEVICE_JWT_SECRET', 'INTERNAL_API_SECRET'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      Logger.error(`❌ Missing required production env vars: ${missing.join(', ')}`);
      Logger.error('Set these in your .env or deployment config before starting in production.');
      process.exit(1);
    }
  }

  // rawBody:true is REQUIRED for PSP webhook signature verification — the Stripe
  // and Razorpay handlers read req.rawBody to verify the signature over the exact
  // bytes. Without it req.rawBody is undefined and every webhook 400s before it is
  // ever authenticated (billing was silently non-functional prior to this).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Trust proxy — sets req.ip from X-Forwarded-For according to the
  // configured hop count. Without this, GeoService and the rate-
  // limiter key on the upstream proxy's IP (loopback in our prod
  // nginx setup) instead of the real client IP. The R6 webhooks+
  // common scout flagged this as a CRITICAL gap because country-
  // based provider routing (Stripe vs Razorpay) and per-IP throttles
  // were both running on the wrong key.
  //
  // TRUST_PROXY_HOPS defaults to 1 (single nginx in front). Bump if
  // additional reverse proxies (CDN, ALB) sit between nginx and
  // Node — setting it too high lets a malicious client spoof IPs
  // via X-Forwarded-For, so keep it tight to the actual topology.
  const trustProxyHops = parseInt(process.env.TRUST_PROXY_HOPS || '1', 10);
  if (Number.isFinite(trustProxyHops) && trustProxyHops >= 0) {
    app.set('trust proxy', trustProxyHops);
    Logger.log(`Express trust proxy configured at ${trustProxyHops} hop(s)`);
  } else {
    Logger.warn(
      `TRUST_PROXY_HOPS="${process.env.TRUST_PROXY_HOPS}" invalid; defaulting to 1 hop`,
    );
    app.set('trust proxy', 1);
  }

  // Serve static files (thumbnails) with cache headers
  app.useStaticAssets(join(process.cwd(), 'static'), {
    prefix: '/static/',
    maxAge: '7d',
    etag: true,
  });

  // Serve template seed thumbnails (templates/ is at repo root, one level up from middleware cwd)
  app.useStaticAssets(join(process.cwd(), '..', 'templates', 'seed'), {
    prefix: '/templates/seed/',
    maxAge: '30d',
    etag: true,
  });

  // NOTE: /uploads/ static route removed for security (H2).
  // Local files must be served through authenticated device-content endpoint.
  // MinIO-stored content (primary) is already served via DeviceContentController.

  // Response compression (gzip/brotli) — reduces API payload sizes by 60-80%
  app.use(compression({ threshold: 1024, level: 6 }));

  // Cookie parser (required for httpOnly cookie authentication)
  app.use(cookieParser());

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false, // Allow embedding for display clients
  }));

  // Cross-Origin-Resource-Policy relaxation, scoped to the device-content route
  // ONLY. helmet's default `same-origin` stays in force everywhere else.
  //
  // Packaged Tizen/webOS apps render media from a file:// document, so their
  // <img>/<video> loads are cross-origin *no-cors* requests — CORS does not
  // apply to those, CORP does, and a same-origin CORP would block them. (The
  // offline cache's fetch() is the opposite case: CORS applies, CORP does not.
  // Both mechanisms are needed, for different request modes.)
  //
  // Gated by the same fail-closed flag as the CORS exception. Runs AFTER
  // helmet so setHeader overrides the default it just set.
  if (isNullOriginCorsEnabled()) {
    app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
      if (isDeviceContentPath(req.originalUrl || req.url)) {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      }
      next();
    });
  }

  // CORS configuration — ONE request-aware delegate (see common/cors/cors-policy.ts).
  //
  // ExpressAdapter.enableCors(options) does `this.use(cors(options))`, and the
  // cors package treats a function as a per-request options callback, so this
  // is a single middleware making a single decision. It must NOT be layered
  // with a second cors() call: a null-origin response that passed through a
  // static `credentials: true` cors() would carry
  // Access-Control-Allow-Credentials, which is the precise grant this design
  // exists to withhold.
  app.enableCors(createCorsDelegate());

  Logger.log(
    `Device null-origin CORS: ${isNullOriginCorsEnabled() ? 'ENABLED' : 'disabled (default)'}`,
  );

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
    new LoggingInterceptor(reflector),
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
    const code = (error as NodeJS.ErrnoException)?.code;
    Logger.error(`❌ FATAL: Cannot bind to port ${port} (code=${code || 'unknown'})`);
    if (code === 'EADDRINUSE') {
      Logger.error(`Another process is using port ${port}. Stop it first.`);
      Logger.error(`Run: netstat -ano | findstr :${port}`);
    } else if (code === 'EACCES') {
      Logger.error(`Permission denied binding to port ${port}. Ports below 1024 require elevated privileges.`);
    } else {
      // Log the full stack — a bare `.message` (e.g. a TypeError thrown from a
      // bootstrap hook or the http stack) hides WHERE the failure is and makes
      // a prod boot failure undiagnosable from logs alone.
      Logger.error(`Underlying error: ${(error as Error)?.message || error}`);
      if ((error as Error)?.stack) {
        Logger.error((error as Error).stack);
      }
    }
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  Logger.error('💥 Fatal error during bootstrap:', err);
  process.exit(1);
});

// Catch unhandled rejections: log and capture for alerting, but don't exit.
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  Logger.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});
