import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for CreateTestdataDto
 * Defines the structure of request/response data
 */

export class CreateTestdataDto {
  @ApiProperty({ required: true, type: String })
  /** name field (required) */
  name!: string;

  @ApiProperty({ required: true, type: String })
  /** email field (required) */
  email!: string;

  @ApiPropertyOptional({ required: false, type: Number })
  /** age field (optional) */
  age?: number;
}
