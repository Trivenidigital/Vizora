import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { DisplaysService } from './displays.service';
import { DisplaysController } from './displays.controller';
import { PairingService } from './pairing.service';
import { PairingController } from './pairing.controller';
import { DeviceAuthCheckService } from './device-auth-check.service';
import { DeviceAuthController } from './device-auth.controller';
import { StorageModule } from '../storage/storage.module';
import { BillingModule } from '../billing/billing.module';
import { ProvisioningTemplatesModule } from '../provisioning-templates/provisioning-templates.module';

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
    // O6 — PairingService.completePairing pulls defaults from the
    // ProvisioningTemplate model when a templateId is supplied.
    ProvisioningTemplatesModule,
  ],
  controllers: [DisplaysController, PairingController, DeviceAuthController],
  providers: [DisplaysService, PairingService, DeviceAuthCheckService],
  exports: [DisplaysService, PairingService],
})
export class DisplaysModule {}
