import { Test, TestingModule } from '@nestjs/testing';
import { EmpService } from './emp.service';
import { BadRequestException } from '@nestjs/common';

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

  it('should return bad request when required fields are missing for updateEmp', (done) => {
    service.updateEmp({} as any).subscribe({
      next: () => done(new Error('Expected error')),
      error: (error) => {
        expect(error).toBeInstanceOf(BadRequestException);
        done();
      },
    });
  });
});
