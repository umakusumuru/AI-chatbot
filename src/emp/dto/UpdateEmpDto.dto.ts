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
 * Data Transfer Object for UpdateEmpDto
 * Defines the structure of request/response data
 */

export class UpdateEmpDtoMessageSender {
  @ApiProperty({ required: true, type: String })
  @IsString()
  @IsNotEmpty()
  /** userId field (required) */
  userId!: string;
}

export class UpdateEmpDtoMessage {
  @ApiProperty({ required: true, type: String })
  @IsString()
  @IsNotEmpty()
  /** text field (required) */
  text!: string;

  @ApiProperty({ required: true, type: UpdateEmpDtoMessageSender })
  @ValidateNested()
  @Type(() => UpdateEmpDtoMessageSender)
  @IsNotEmpty()
  /** sender field (required) */
  sender!: UpdateEmpDtoMessageSender;
}

export class UpdateEmpDto {
  @ApiProperty({ required: true, type: UpdateEmpDtoMessage })
  @ValidateNested()
  @Type(() => UpdateEmpDtoMessage)
  @IsNotEmpty()
  /** message field (required) */
  message!: UpdateEmpDtoMessage;

  @ApiPropertyOptional({ required: false, type: String })
  @IsString()
  @IsOptional()
  /** sessionId field (optional) */
  sessionId?: string;
}
