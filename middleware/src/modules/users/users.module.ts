import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';

@Module({
  controllers: [UsersController, AuditLogController],
  providers: [UsersService, AuditLogService],
  exports: [UsersService, AuditLogService],
})
export class UsersModule {}
