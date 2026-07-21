import { Test, TestingModule } from '@nestjs/testing';
import { EmpService } from './emp.service';

describe('EmpService', () => {
  let service: EmpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmpService],
    }).compile();

    service = module.get<EmpService>(EmpService);
  });

  it('should getEmp', (done) => {
    service.getEmp().subscribe({
      next: (result) => {
        expect(result).toBeDefined();
        done();
      },
      error: done,
    });
  });

  it('should updateEmp', (done) => {
    service
      .updateEmp({
        message: {
          text: 'text-sample',
          sender: {
            userId: 'userId-sample',
          },
        },
        sessionId: 'sessionId-sample',
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
