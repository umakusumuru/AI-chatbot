import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TranslateDto {
  @ApiProperty({ required: true, type: String })
  text!: string;

  @ApiPropertyOptional({ required: false, type: String })
  lang?: string;
}
