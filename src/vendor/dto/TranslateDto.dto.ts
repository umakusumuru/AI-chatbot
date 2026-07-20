import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for TranslateDto
 * Defines the structure of request/response data
 */

export class TranslateDto {
  @ApiProperty({ required: true, type: String })
  /** text field (required) */
  text!: string;

  @ApiPropertyOptional({ required: false, type: String })
  /** lang field (optional) */
  lang?: string;
}
