import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return {
      status: 'ok',
      message: 'AI chatbot API scaffold is ready.'
    };
  }
}
