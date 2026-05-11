import { Controller, Body, Param, Get, Post, Put, Delete, Patch } from '@nestjs/common';
import { ApiBody, ApiBadRequestResponse, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/CreateUserDto.dto';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly service: UserService) {}

  // Fetch all users
  @Get('')
  @ApiOperation({ summary: 'Fetch all users' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
  getAllUsers(): Observable<{ id: string; name: string; email: string }[]> {
    return this.service.getAllUsers();
  }

  // Create a new user
  @Post('create')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
  @ApiBody({ type: CreateUserDto })
  createUser(@Body() body: CreateUserDto): Observable<{ id: string; name: string; email: string }> {
    return this.service.createUser(body);
  }

  // Get user by ID
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'Successful response.' })
  @ApiBadRequestResponse({ description: 'Invalid request.' })
  @ApiNotFoundResponse({ description: 'Resource not found.' })
  getUserById(@Param('id') id: string): Observable<{ id: string; name: string; email: string }> {
    return this.service.getUserById(id);
  }

}
