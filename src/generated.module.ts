import { Module } from "@nestjs/common";
import { ChatModule } from "./chat/chat.module";
import { TestModule } from "./test/test.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [ChatModule, TestModule, UserModule],
  controllers: [],
  providers: [],
})
export class GeneratedModule {}
