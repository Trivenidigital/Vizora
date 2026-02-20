import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [UsersController, AuditLogController],
  providers: [UsersService, AuditLogService],
  exports: [UsersService, AuditLogService],
})
export class UsersModule {}
