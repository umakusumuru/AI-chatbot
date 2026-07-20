import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

/**
 * UserModule
 *
 * NestJS module for the user feature.
 * Declares and exports the controller and service for this domain.
 */
@Module({
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
