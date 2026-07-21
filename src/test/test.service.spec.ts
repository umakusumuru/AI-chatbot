import { Test, TestingModule } from '@nestjs/testing';
import { TestService } from './test.service';
import { NotFoundException } from '@nestjs/common';

describe('TestService', () => {
  let service: TestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestService],
    }).compile();

    service = module.get<TestService>(TestService);
  });

  it('should getAlltestdata', (done) => {
    service.getAlltestdata().subscribe({
      next: (result) => {
        expect(result).toBeDefined();
        done();
      },
      error: done,
    });
  });

  it('should createTestdata', (done) => {
    service
      .createTestdata({
        name: 'name-sample',
        email: 'email-sample',
        age: 1,
      } as any)
      .subscribe({
        next: (result) => {
          expect(result).toBeDefined();
          done();
        },
        error: done,
      });
  });

  it('should getTestdataById', (done) => {
    service.getTestdataById('1').subscribe({
      next: (result) => {
        expect(result).toBeDefined();
        done();
      },
      error: done,
    });
  });

  it('should return not found for id 0 on getTestdataById', (done) => {
    service.getTestdataById('0').subscribe({
      next: () => done(new Error('Expected error')),
      error: (error) => {
        expect(error).toBeInstanceOf(NotFoundException);
        done();
      },
    });
  });
});
