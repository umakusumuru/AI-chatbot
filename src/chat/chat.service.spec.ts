import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should getHealth', (done) => {
    service.getHealth().subscribe({
      next: (result) => {
        expect(result).toBeDefined();
        done();
      },
      error: done,
    });
  });

  it('should sendMessage', (done) => {
    service
      .sendMessage({
        message: 'message-sample',
        sessionId: 'sessionId-sample',
        userId: 'userId-sample',
        chatlist: {
          chat1: 'chat1-sample',
        },
      } as any)
      .subscribe({
        next: (result) => {
          expect(result).toBeDefined();
          done();
        },
        error: done,
      });
  });
});
