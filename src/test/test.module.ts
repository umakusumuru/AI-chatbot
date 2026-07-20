import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { TestService } from './test.service';

/**
 * TestModule
 *
 * NestJS module for the test feature.
 * Declares and exports the controller and service for this domain.
 */
@Module({
  controllers: [TestController],
  providers: [TestService],
})
export class TestModule {}
