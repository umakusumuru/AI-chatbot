import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should return all users', (done) => {
    service.getAllUsers().subscribe((result) => {
      expect(result.length).toBeGreaterThan(0);
      done();
    });
  });

  it('should return bad request when required fields are missing', (done) => {
    service.createUser({} as any).subscribe({
      next: () => done(new Error('Expected error')),
      error: (error) => {
        expect(error).toBeInstanceOf(BadRequestException);
        done();
      },
    });
  });

  it('should return not found for id 0', (done) => {
    service.getUserById('0').subscribe({
      next: () => done(new Error('Expected error')),
      error: (error) => {
        expect(error).toBeInstanceOf(NotFoundException);
        done();
      },
    });
  });
});
