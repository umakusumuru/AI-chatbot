import { Controller, Body, Param, Get, Post, Put, Delete, Patch } from '@nestjs/common';
import { ApiBody, ApiBadRequestResponse, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/SendMessageDto.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly service: ChatService) {}

  // Returns API health status
  @Get('health')
  @ApiOperation({ summary: 'Returns API health status' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
  getHealth(): Observable<{ status: string; message: string }> {
    return this.service.getHealth();
  }

  // Sends a chat message and returns a response
  @Post('message')
  @ApiOperation({ summary: 'Sends a chat message and returns a response' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
  @ApiBody({ type: SendMessageDto })
  sendMessage(@Body() body: SendMessageDto): Observable<{ reply: string }> {
    return this.service.sendMessage(body);
  }

}
