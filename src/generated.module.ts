import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { EmpModule } from './emp/emp.module';
import { TestModule } from './test/test.module';
import { UserModule } from './user/user.module';
import { VendorModule } from './vendor/vendor.module';

@Module({
  imports: [ChatModule, EmpModule, TestModule, UserModule, VendorModule],
  controllers: [],
  providers: [],
})
export class GeneratedModule {}
