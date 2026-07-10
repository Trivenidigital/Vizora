import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseService } from './database.service';
import { TenantContextInterceptor } from './tenant-context.interceptor';

@Global()
@Module({
  providers: [
    DatabaseService,
    // Binds per-request tenant context for the Prisma tenant-guard. Inert in
    // `off` mode (guard not applied); log-mode only observes.
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
