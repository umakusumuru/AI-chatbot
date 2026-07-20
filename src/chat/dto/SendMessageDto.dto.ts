import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for SendMessageDto
 * Defines the structure of request/response data
 */

export class SendMessageDtoChatlist {
  @ApiPropertyOptional({ required: false, type: String })
  /** chat1 field (optional) */
  chat1?: string;
}

export class SendMessageDto {
  @ApiProperty({ required: true, type: String })
  /** message field (required) */
  message!: string;

  @ApiPropertyOptional({ required: false, type: String })
  /** sessionId field (optional) */
  sessionId?: string;

  @ApiPropertyOptional({ required: false, type: String })
  /** userId field (optional) */
  userId?: string;

  @ApiPropertyOptional({ required: false, type: SendMessageDtoChatlist })
  /** chatlist field (optional) */
  chatlist?: SendMessageDtoChatlist;
}
