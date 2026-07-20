import { Module } from '@nestjs/common';
import { VendorController } from './vendor.controller';
import { VendorService } from './vendor.service';

/**
 * VendorModule
 *
 * NestJS module for the vendor feature.
 * Declares and exports the controller and service for this domain.
 */
@Module({
  controllers: [VendorController],
  providers: [VendorService],
})
export class VendorModule {}
