import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import { CreateTestdataDto } from './dto/CreateTestdataDto.dto';

/**
 * TestService
 *
 * Service for the test feature.
 * Contains business logic for all test operations.
 */
@Injectable()
export class TestService {
  /**
   * Fetch all test data
   *
   * @returns Observable of type { id: string; name: string; email: string }[]
   */
  getAlltestdata(): Observable<{ id: string; name: string; email: string }[]> {
    // Test data - Replace with actual business logic
    return of([
      {
        id: '1',
        name: 'Sample Item 1',
        email: 'item1@example.com',
      },
      {
        id: '2',
        name: 'Sample Item 2',
        email: 'item2@example.com',
      },
    ] as unknown as { id: string; name: string; email: string }[]);
  }

  /**
   * Create a new test data
   *
   * @param body - The request payload (CreateTestdataDto)
   * @returns Observable of type { id: string; name: string; email: string }
   */
  createTestdata(
    body: CreateTestdataDto
  ): Observable<{ id: string; name: string; email: string }> {
    const missingFields = ['name', 'email'].filter(
      (key) => !(body as any)?.[key]
    );
    if (missingFields.length) {
      return throwError(
        () =>
          new BadRequestException(
            `Missing required field(s): ${missingFields.join(', ')}`
          )
      );
    }

    // Test data - Replace with actual business logic
    return of({
      ...body,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      status: 'success',
    } as unknown as { id: string; name: string; email: string });
  }

  /**
   * Get test data by ID
   * @param id - The resource identifier
   * @returns Observable of type { id: string; name: string; email: string }
   */
  getTestdataById(
    id: string
  ): Observable<{ id: string; name: string; email: string }> {
    if (id === '0') {
      return throwError(() => new NotFoundException('Resource not found'));
    }

    // Test data - Replace with actual business logic
    return of({
      id: id,
      name: 'Sample GetTestdataById',
      email: 'sample@example.com',
    } as unknown as { id: string; name: string; email: string });
  }
}
