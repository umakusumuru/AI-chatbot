import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Observable, of, throwError, from } from 'rxjs';
import { SendMessageDto } from './dto/SendMessageDto.dto';
// Helper: simple template resolver for objects/strings containing {{...}} placeholders
function __resolvePath(path: string, ctx: any) {
  try {
    const parts = path.split('.');
    let cur: any = ctx;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  } catch (e) {
    return undefined;
  }
}

function __applyTemplate(template: any, ctx: any): any {
  if (template == null) return template;
  if (Array.isArray(template))
    return template.map((t) => __applyTemplate(t, ctx));
  if (typeof template === 'object') {
    const out: any = {};
    for (const k of Object.keys(template)) {
      out[k] = __applyTemplate((template as any)[k], ctx);
    }
    return out;
  }
  if (typeof template === 'string') {
    return template.replace(/\{\{(.+?)\}\}/g, (_m, expr) => {
      const val = __resolvePath(expr.trim(), ctx);
      return val == null ? '' : String(val);
    });
  }
  return template;
}

@Injectable()
export class ChatService {
  getHealth(): Observable<{ status: string; message: string }> {
    // Test data - Replace with actual business logic
    return of({
      id: '1',
      name: 'Sample GetHealth',
      email: 'sample@example.com',
    } as unknown as { status: string; message: string });
  }

  sendMessage(body: SendMessageDto): Observable<{ reply: string }> {
    const missingFields = ['message'].filter((key) => !(body as any)?.[key]);
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
    } as unknown as { reply: string });
  }
}
