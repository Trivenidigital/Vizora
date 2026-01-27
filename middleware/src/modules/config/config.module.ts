import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv, EnvConfig } from './env.validation';
import * as path from 'path';

// Resolve .env path from workspace root (handles both dev and prod)
const envPath = process.env.NODE_ENV === 'production' 
  ? path.resolve(process.cwd(), '.env')
  : path.resolve(__dirname, '../../../../.env');

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: [
        path.resolve(process.cwd(), '.env.local'),
        path.resolve(process.cwd(), '.env'),
        envPath,
      ],
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}

// Helper type for typed config access
export { EnvConfig };
