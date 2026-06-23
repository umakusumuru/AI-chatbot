import {
  Controller,
  Body,
  Param,
  Get,
  Post,
  Put,
  Delete,
  Patch,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { VendorService } from './vendor.service';
import { TranslateDto } from './dto/TranslateDto.dto';

@ApiTags('vendor')
@Controller('vendor')
export class VendorController {
  constructor(private readonly service: VendorService) {}

  // Proxy to external vendor API (example)
  @Post('translate')
  @ApiOperation({ summary: 'Proxy to external vendor API (example)' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
  @ApiBody({ type: TranslateDto })
  translateText(@Body() body: TranslateDto): Observable<any> {
    return this.service.translateText(body);
  }
}
