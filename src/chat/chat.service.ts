import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Observable, of, throwError } from "rxjs";
import { SendMessageDto } from './dto/SendMessageDto.dto';

@Injectable()
export class ChatService {
  getHealth(): Observable<{ status: string; message: string }> {
    // Test data - Replace with actual business logic
    return of({
      id: '1',
      name: 'Sample GetHealth',
      email: 'sample@example.com'
    } as unknown as { status: string; message: string });
  }

  sendMessage(body: SendMessageDto): Observable<{ reply: string }> {
    const missingFields = ['message'].filter((key) => !(body as any)?.[key]);
    if (missingFields.length) {
      return throwError(() => new BadRequestException(`Missing required field(s): ${missingFields.join(', ')}`));
    }

    // Test data - Replace with actual business logic
    return of({
      ...body,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      status: 'success'
    } as unknown as { reply: string });
  }
}
