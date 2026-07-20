import {
  Controller,
  Body,
  Param,
  Get,
  Post,
  Put,
  Delete,
  Patch,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/SendMessageDto.dto';

/**
 * ChatController
 *
 * Handles HTTP requests for the chat feature.
 * Routes are prefixed with /chat.
 */
@ApiTags('chat')
@Controller('chat')
export class ChatController {
  /**
   * Constructor
   * @param service - The ChatService instance
   */
  constructor(private readonly service: ChatService) {}

  /**
   * Returns API health status
   * @returns Observable of type { status: string; message: string }
   */
  @Get('health')
  @ApiOperation({ summary: 'Returns API health status' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
  getHealth(): Observable<{ status: string; message: string }> {
    return this.service.getHealth();
  }

  /**
   * Sends a chat message and returns a response
   * @param body - The request payload (SendMessageDto)
   * @returns Observable of type { reply: string; sessionId: string }
   */
  @Post('message')
  @ApiOperation({ summary: 'Sends a chat message and returns a response' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
  @ApiBody({ type: SendMessageDto })
  sendMessage(
    @Body() body: SendMessageDto
  ): Observable<{ reply: string; sessionId: string }> {
    return this.service.sendMessage(body);
  }
}
