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
 * Data Transfer Object for TranslateDto
 * Defines the structure of request/response data
 */

export class TranslateDto {
  @ApiProperty({ required: true, type: String })
  @IsString()
  @IsNotEmpty()
  /** text field (required) */
  text!: string;

  @ApiPropertyOptional({ required: false, type: String })
  @IsString()
  @IsOptional()
  /** lang field (optional) */
  lang?: string;
}
