import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { DisplaysService } from './displays.service';
import { DisplaysController } from './displays.controller';
import { PairingService } from './pairing.service';
import { PairingController } from './pairing.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.DEVICE_JWT_SECRET || process.env.JWT_SECRET,
        signOptions: {
          expiresIn: '30d', // Device tokens last longer
        },
      }),
    }),
    HttpModule,
  ],
  controllers: [DisplaysController, PairingController],
  providers: [DisplaysService, PairingService],
  exports: [DisplaysService, PairingService],
})
export class DisplaysModule {}
