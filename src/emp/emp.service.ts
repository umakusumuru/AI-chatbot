import { Injectable } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { UpdateEmpDto } from './dto/UpdateEmpDto.dto';

/**
 * EmpService
 *
 * Service for the emp feature.
 * Contains business logic for all emp operations.
 */
@Injectable()
export class EmpService {
  /**
   * Returns employee information
   *
   * @returns Observable of type { id: string; name: string; email: string }
   */
  getEmp(): Observable<{ id: string; name: string; email: string }> {
    // Test data - Replace with actual business logic
    return of({
      id: '1',
      name: 'Sample GetEmp',
      email: 'sample@example.com',
    } as unknown as { id: string; name: string; email: string });
  }

  /**
   * Updates employee information
   *
   * @param body - The request payload (UpdateEmpDto)
   * @returns Observable of type { reply: string }
   */
  updateEmp(body: UpdateEmpDto): Observable<{ reply: string }> {
    // Test data - Replace with actual business logic
    return of({
      ...body,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      status: 'success',
    } as unknown as { reply: string });
  }
}
