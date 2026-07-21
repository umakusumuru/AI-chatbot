import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Data Transfer Object for SendMessageDto
 * Defines the structure of request/response data
 */

export class SendMessageDtoChatlist {
  @ApiPropertyOptional({ required: false, type: String })
  @IsString()
  @IsOptional()
  /** chat1 field (optional) */
  chat1?: string;
}

export class SendMessageDto {
  @ApiProperty({ required: true, type: String })
  @IsString()
  @IsNotEmpty()
  /** message field (required) */
  message!: string;

  @ApiPropertyOptional({ required: false, type: String })
  @IsString()
  @IsOptional()
  /** sessionId field (optional) */
  sessionId?: string;

  @ApiPropertyOptional({ required: false, type: String })
  @IsString()
  @IsOptional()
  /** userId field (optional) */
  userId?: string;

  @ApiPropertyOptional({ required: false, type: SendMessageDtoChatlist })
  @ValidateNested()
  @Type(() => SendMessageDtoChatlist)
  @IsOptional()
  /** chatlist field (optional) */
  chatlist?: SendMessageDtoChatlist;
}
