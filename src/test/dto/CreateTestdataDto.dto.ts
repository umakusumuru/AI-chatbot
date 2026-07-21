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
 * Data Transfer Object for CreateTestdataDto
 * Defines the structure of request/response data
 */

export class CreateTestdataDto {
  @ApiProperty({ required: true, type: String })
  @IsString()
  @IsNotEmpty()
  /** name field (required) */
  name!: string;

  @ApiProperty({ required: true, type: String })
  @IsString()
  @IsNotEmpty()
  /** email field (required) */
  email!: string;

  @ApiPropertyOptional({ required: false, type: Number })
  @IsNumber()
  @IsOptional()
  /** age field (optional) */
  age?: number;
}
