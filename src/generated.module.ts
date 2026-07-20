import { Module } from '@nestjs/common';
import { EmpModule } from './emp/emp.module';
import { ChatModule } from './chat/chat.module';
import { TestModule } from './test/test.module';
import { UserModule } from './user/user.module';
import { VendorModule } from './vendor/vendor.module';

@Module({
  imports: [EmpModule, ChatModule, TestModule, UserModule, VendorModule],
  controllers: [],
  providers: [],
})
export class GeneratedModule {}
