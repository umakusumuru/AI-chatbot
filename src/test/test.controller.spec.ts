import { Test, TestingModule } from '@nestjs/testing';
import { TestController } from './test.controller';
import { TestService } from './test.service';

describe('TestController', () => {
  let controller: TestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestController],
      providers: [TestService],
    }).compile();

    controller = module.get<TestController>(TestController);
  });

  it('should getAlltestdata', (done) => {
    controller.getAlltestdata().subscribe({
      next: (result) => {
        expect(result).toBeDefined();
        done();
      },
      error: done,
    });
  });

  it('should createTestdata', (done) => {
    controller
      .createTestdata({
        name: 'name-sample',
        email: 'email-sample',
        age: 1,
      })
      .subscribe({
        next: (result) => {
          expect(result).toBeDefined();
          done();
        },
        error: done,
      });
  });

  it('should getTestdataById', (done) => {
    controller.getTestdataById('1').subscribe({
      next: (result) => {
        expect(result).toBeDefined();
        done();
      },
      error: done,
    });
  });
});
