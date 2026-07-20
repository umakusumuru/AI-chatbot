import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for UpdateEmpDto
 * Defines the structure of request/response data
 */

export class UpdateEmpDtoMessageSender {
  @ApiProperty({ required: true, type: String })
  /** userId field (required) */
  userId!: string;
}

export class UpdateEmpDtoMessage {
  @ApiProperty({ required: true, type: String })
  /** text field (required) */
  text!: string;

  @ApiProperty({ required: true, type: UpdateEmpDtoMessageSender })
  /** sender field (required) */
  sender!: UpdateEmpDtoMessageSender;
}

export class UpdateEmpDto {
  @ApiProperty({ required: true, type: UpdateEmpDtoMessage })
  /** message field (required) */
  message!: UpdateEmpDtoMessage;

  @ApiPropertyOptional({ required: false, type: String })
  /** sessionId field (optional) */
  sessionId?: string;
}
