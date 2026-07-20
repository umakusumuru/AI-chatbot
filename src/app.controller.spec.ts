import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { of, throwError } from 'rxjs';

const moduleRefMocks: any = {
  mockService: {
    getStatus: jest.fn(),
  }
};

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: AppService, useValue: moduleRefMocks.mockService },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('calls service.getStatus and returns its value', () => {
    const mockVal = { result: 'ok' };
    const mockService: any = moduleRefMocks.mockService;
    mockService.getStatus.mockReturnValue(mockVal);

    const res = controller.getStatus();
    expect(mockService.getStatus).toHaveBeenCalledWith();
    expect(res).toEqual(mockVal);
  });

  it('propagates errors from service.getStatus', () => {
    const mockService: any = moduleRefMocks.mockService;
    mockService.getStatus.mockImplementation(() => { throw new Error('svc-fail'); });

    expect(() => controller.getStatus()).toThrow();
  });
});
