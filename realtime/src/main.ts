import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { initializeSentry } from './config/sentry.config';

// Initialize Sentry before app starts
initializeSentry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3002',
      'http://localhost:4200',
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Use Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  
  // STRICT PORT ENFORCEMENT - Realtime MUST use port 3002
  const port = 3002;
  const assignedPort = process.env.REALTIME_PORT || process.env.PORT;
  
  if (assignedPort && parseInt(assignedPort) !== port) {
    Logger.error(`❌ CONFIGURATION ERROR: Realtime must use port ${port}, not ${assignedPort}`);
    Logger.error(`Update .env: REALTIME_PORT=${port}`);
    process.exit(1);
  }

  try {
    await app.listen(port, '0.0.0.0');
    Logger.log(`🚀 Realtime Gateway running on: http://localhost:${port}/${globalPrefix}`);
    Logger.log(`🔌 WebSocket server ready on: ws://localhost:${port}`);
    Logger.log(`📊 Metrics available at: http://localhost:${port}/metrics`);
    Logger.log(`⚠️  Port ${port} is RESERVED for Realtime - will not start if occupied`);
  } catch (error) {
    Logger.error(`❌ FATAL: Cannot bind to port ${port}`);
    Logger.error(`Another process is using port ${port}. Stop it first.`);
    Logger.error(`Run: netstat -ano | findstr :${port}`);
    process.exit(1);
  }
}

bootstrap();
