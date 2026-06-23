import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [UserService],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should return all users', (done) => {
    controller.getAllUsers().subscribe((result) => {
      expect(result.length).toBeGreaterThan(0);
      done();
    });
  });

  it('should return user data by id', (done) => {
    controller.getUserById('1').subscribe((result) => {
      expect(result).toEqual({
        id: '1',
        name: 'Sample GetUserById',
        email: 'sample@example.com',
      });
      done();
    });
  });
});
