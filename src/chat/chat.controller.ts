import { Controller, Body, Get, Post, Put, Delete, Patch } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/SendMessageDto.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly service: ChatService) {}

  // Returns API health status
  @Get('health')
  getHealth(): Observable<{ status: string; message: string }> {
    return this.service.getHealth();
  }

  // Sends a chat message and returns a response
  @Post('message')
  sendMessage(@Body() body: SendMessageDto): Observable<{ reply: string }> {
    return this.service.sendMessage(body);
  }

}
