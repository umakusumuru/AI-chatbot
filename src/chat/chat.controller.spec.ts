import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [ChatService],
    }).compile();

    controller = module.get<ChatController>(ChatController);
  });

  it('should getHealth', (done) => {
    controller.getHealth().subscribe({
      next: (result) => {
        expect(result).toBeDefined();
        done();
      },
      error: done,
    });
  });

  it('should sendMessage', (done) => {
    controller
      .sendMessage({
        message: 'message-sample',
        sessionId: 'sessionId-sample',
        userId: 'userId-sample',
        chatlist: {
          chat1: 'chat1-sample',
        },
      })
      .subscribe({
        next: (result) => {
          expect(result).toBeDefined();
          done();
        },
        error: done,
      });
  });
});
