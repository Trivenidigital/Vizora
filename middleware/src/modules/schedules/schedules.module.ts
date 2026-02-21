import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    BillingModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.DEVICE_JWT_SECRET,
      }),
    }),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
