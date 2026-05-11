import { Controller, Body, Param, Get, Post, Put, Delete, Patch } from '@nestjs/common';
import { ApiBody, ApiBadRequestResponse, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { TestService } from './test.service';
import { CreateTestdataDto } from './dto/CreateTestdataDto.dto';

@ApiTags('test')
@Controller('test')
export class TestController {
  constructor(private readonly service: TestService) {}

  // Fetch all test data
  @Get('')
  @ApiOperation({ summary: 'Fetch all test data' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
  getAlltestdata(): Observable<{ id: string; name: string; email: string }[]> {
    return this.service.getAlltestdata();
  }

  // Create a new test data
  @Post('create')
  @ApiOperation({ summary: 'Create a new test data' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
  @ApiBody({ type: CreateTestdataDto })
  createTestdata(@Body() body: CreateTestdataDto): Observable<{ id: string; name: string; email: string }> {
    return this.service.createTestdata(body);
  }

  // Get test data by ID
  @Get(':id')
  @ApiOperation({ summary: 'Get test data by ID' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
  @ApiNotFoundResponse({ description: 'Resource not found.' })
  getTestdataById(@Param('id') id: string): Observable<{ id: string; name: string; email: string }> {
    return this.service.getTestdataById(id);
  }

}
