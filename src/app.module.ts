import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { GeneratedModule } from "./generated.module";

@Module({
  imports: [GeneratedModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
