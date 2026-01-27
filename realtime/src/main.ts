import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';

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
  const port = process.env.REALTIME_PORT || process.env.PORT || 3001;

  await app.listen(port);
  Logger.log(
    `🚀 Realtime Gateway running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(`🔌 WebSocket server ready on: ws://localhost:${port}`);
}

bootstrap();
