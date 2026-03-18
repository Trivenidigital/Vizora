import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ValidationMonitorService } from './validation-monitor.service';
import { StartupSelfTestService } from './startup-self-test.service';
import { ContinuousHealthMonitorService } from './continuous-health-monitor.service';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [DatabaseModule, RedisModule, StorageModule],
  controllers: [HealthController],
  providers: [HealthService, ValidationMonitorService, StartupSelfTestService, ContinuousHealthMonitorService],
  exports: [ValidationMonitorService, StartupSelfTestService, ContinuousHealthMonitorService],
})
export class HealthModule {}
