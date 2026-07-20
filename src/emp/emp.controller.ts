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
import { EmpService } from './emp.service';
import { UpdateEmpDto } from './dto/UpdateEmpDto.dto';

/**
 * EmpController
 *
 * Handles HTTP requests for the emp feature.
 * Routes are prefixed with /emp.
 */
@ApiTags('emp')
@Controller('emp')
export class EmpController {
  /**
   * Constructor
   * @param service - The EmpService instance
   */
  constructor(private readonly service: EmpService) {}

  /**
   * Returns employee information
   * @returns Observable of type { id: string; name: string; email: string }
   */
  @Get('getemp')
  @ApiOperation({ summary: 'Returns employee information' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
  getEmp(): Observable<{ id: string; name: string; email: string }> {
    return this.service.getEmp();
  }

  /**
   * Updates employee information
   * @param body - The request payload (UpdateEmpDto)
   * @returns Observable of type { reply: string }
   */
  @Post('updateemp')
  @ApiOperation({ summary: 'Updates employee information' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
  @ApiBody({ type: UpdateEmpDto })
  updateEmp(@Body() body: UpdateEmpDto): Observable<{ reply: string }> {
    return this.service.updateEmp(body);
  }
}
