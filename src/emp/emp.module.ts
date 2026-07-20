import { Module } from '@nestjs/common';
import { EmpController } from './emp.controller';
import { EmpService } from './emp.service';

/**
 * EmpModule
 *
 * NestJS module for the emp feature.
 * Declares and exports the controller and service for this domain.
 */
@Module({
  controllers: [EmpController],
  providers: [EmpService],
})
export class EmpModule {}
