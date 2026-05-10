import { Controller, Body, Get, Post, Put, Delete, Patch } from '@nestjs/common';
import { Observable } from 'rxjs';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/CreateUserDto.dto';

@Controller('user')
export class UserController {
  constructor(private readonly service: UserService) {}

  // Fetch all users
  @Get('')
  getAllUsers(): Observable<{ id: string; name: string; email: string }[]> {
    return this.service.getAllUsers();
  }

  // Create a new user
  @Post('create')
  createUser(@Body() body: CreateUserDto): Observable<{ id: string; name: string; email: string }> {
    return this.service.createUser(body);
  }

  // Get user by ID
  @Get(':id')
  getUserById(): Observable<{ id: string; name: string; email: string }> {
    return this.service.getUserById();
  }

}
