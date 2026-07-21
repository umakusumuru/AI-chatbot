import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { NotFoundException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should getAllUsers', (done) => {
    service.getAllUsers().subscribe({
      next: (result) => {
        expect(result).toBeDefined();
        done();
      },
      error: done,
    });
  });

  it('should createUser', (done) => {
    service
      .createUser({
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

  it('should getUserById', (done) => {
    service.getUserById('1').subscribe({
      next: (result) => {
        expect(result).toBeDefined();
        done();
      },
      error: done,
    });
  });

  it('should return not found for id 0 on getUserById', (done) => {
    service.getUserById('0').subscribe({
      next: () => done(new Error('Expected error')),
      error: (error) => {
        expect(error).toBeInstanceOf(NotFoundException);
        done();
      },
    });
  });
});
