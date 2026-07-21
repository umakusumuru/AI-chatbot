import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ required: true, type: String })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({ required: false, type: String })
  @IsString()
  @IsOptional()
  sessionId?: string;
}
