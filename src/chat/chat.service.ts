import { Injectable } from "@nestjs/common";
import { Observable, of } from "rxjs";
import { SendMessageDto } from './dto/SendMessageDto.dto';

@Injectable()
export class ChatService {
  getHealth(): Observable<{ status: string; message: string }> {
    // Test data - Replace with actual business logic
    return of({
    id: '1',
    name: 'Sample GetHealth',
    status: 'active',
    createdAt: new Date()
  } as unknown as { status: string; message: string });
  }

  sendMessage(body: SendMessageDto): Observable<{ reply: string }> {
    // Test data - Replace with actual business logic
    return of({
    ...body,
    id: Math.random().toString(36).substr(2, 9),
    createdAt: new Date(),
    status: 'success'
  } as unknown as { reply: string });
  }
}
