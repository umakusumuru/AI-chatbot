import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

/**
 * ChatModule
 *
 * NestJS module for the chat feature.
 * Declares and exports the controller and service for this domain.
 */
@Module({
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
