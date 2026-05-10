import { Injectable } from "@nestjs/common";
import { Observable, of } from "rxjs";
import { CreateUserDto } from './dto/CreateUserDto.dto';

@Injectable()
export class UserService {
  getAllUsers(): Observable<{ id: string; name: string; email: string }[]> {
    // Test data - Replace with actual business logic
    return of([
    {
      id: '1',
      name: 'Sample Item 1',
      createdAt: new Date()
    },
    {
      id: '2',
      name: 'Sample Item 2',
      createdAt: new Date()
    }
  ] as unknown as { id: string; name: string; email: string }[]);
  }

  createUser(body: CreateUserDto): Observable<{ id: string; name: string; email: string }> {
    // Test data - Replace with actual business logic
    return of({
    ...body,
    id: Math.random().toString(36).substr(2, 9),
    createdAt: new Date(),
    status: 'success'
  } as unknown as { id: string; name: string; email: string });
  }

  getUserById(): Observable<{ id: string; name: string; email: string }> {
    // Test data - Replace with actual business logic
    return of({
    id: '1',
    name: 'Sample GetUserById',
    status: 'active',
    createdAt: new Date()
  } as unknown as { id: string; name: string; email: string });
  }
}
