import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { VendorModule } from './vendor/vendor.module';

@Module({
  imports: [UserModule, VendorModule],
  controllers: [],
  providers: [],
})
export class GeneratedModule {}
