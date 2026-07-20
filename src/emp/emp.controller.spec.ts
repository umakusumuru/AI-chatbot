import { Test, TestingModule } from '@nestjs/testing';
import { EmpController } from './emp.controller';
import { EmpService } from './emp.service';

describe('EmpController', () => {
  let controller: EmpController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmpController],
      providers: [EmpService],
    }).compile();

    controller = module.get<EmpController>(EmpController);
  });

  it('should getEmp', (done) => {
    controller.getEmp().subscribe({
      next: (result) => {
        expect(result).toBeDefined();
        done();
      },
      error: done,
    });
  });

  it('should updateEmp', (done) => {
    controller
      .updateEmp({
        message: {
          text: 'text-sample',
          sender: {
            userId: 'userId-sample',
          },
        },
        sessionId: 'sessionId-sample',
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
