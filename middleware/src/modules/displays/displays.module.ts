import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { DisplaysService } from './displays.service';
import { DisplaysController } from './displays.controller';
import { PairingService } from './pairing.service';
import { PairingController } from './pairing.controller';
import { StorageModule } from '../storage/storage.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    BillingModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.DEVICE_JWT_SECRET,
        signOptions: {
          expiresIn: '30d', // Device tokens last longer
        },
      }),
    }),
    HttpModule,
    StorageModule,
  ],
  controllers: [DisplaysController, PairingController],
  providers: [DisplaysService, PairingService],
  exports: [DisplaysService, PairingService],
})
export class DisplaysModule {}
