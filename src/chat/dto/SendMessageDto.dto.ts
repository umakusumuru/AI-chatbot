import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ required: true, type: String })
  message!: string;

  @ApiPropertyOptional({ required: false, type: String })
  sessionId?: string;
}