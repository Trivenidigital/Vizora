import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global() // Make Redis available globally without importing in every module
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
