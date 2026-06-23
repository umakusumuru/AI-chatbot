import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ required: true, type: String })
  name!: string;

  @ApiProperty({ required: true, type: String })
  email!: string;

  @ApiPropertyOptional({ required: false, type: Number })
  age?: number;
}
