import {
  Injectable,
  BadRequestException,
  BadGatewayException,
} from '@nestjs/common';
import { Observable, of, throwError, from } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TranslateDto } from './dto/TranslateDto.dto';
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

/**
 * VendorService
 *
 * Service for the vendor feature.
 * Contains business logic for all vendor operations.
 */
@Injectable()
export class VendorService {
  translateText(body: TranslateDto): Observable<any> {
    const missingFields = ['text'].filter((key) => !(body as any)?.[key]);
    if (missingFields.length) {
      return throwError(
        () =>
          new BadRequestException(
            `Missing required field(s): ${missingFields.join(', ')}`
          )
      );
    }

    // Vendor proxy - forwards request to external API
    const vendorUrl = __applyTemplate('https://postman-echo.com/post', {
      body,
    });
    const vendorBody = __applyTemplate(
      { input: '{{body.text}}', target: '{{body.lang}}' },
      { body }
    );
    const vendorHeaders = __applyTemplate(
      { 'Content-Type': 'application/json' },
      { body }
    );
    if (process.env.VENDOR_MOCK === 'true') {
      const mock = vendorBody ?? { mocked: true };
      return of(mock as unknown as any);
    }
    return from(
      fetch(vendorUrl, {
        method: 'POST',
        headers: vendorHeaders,
        body: vendorBody === undefined ? undefined : JSON.stringify(vendorBody),
      })
        .then((res) => {
          if (!res.ok) {
            throw new BadGatewayException(
              `Vendor responded with status ${res.status}`
            );
          }
          return res.json();
        })
        .then((vendorRes) => {
          if (vendorRes == null) return vendorRes as unknown as any;
          return vendorRes as unknown as any;
        })
    ).pipe(
      catchError((err) =>
        throwError(() =>
          err instanceof BadGatewayException
            ? err
            : new BadGatewayException('Vendor request failed')
        )
      )
    );
  }
}
