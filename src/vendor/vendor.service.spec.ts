import { Test, TestingModule } from '@nestjs/testing';
import { VendorService } from './vendor.service';
import { BadRequestException } from '@nestjs/common';

describe('VendorService', () => {
  let service: VendorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VendorService],
    }).compile();

    service = module.get<VendorService>(VendorService);
  });

  it('should translateText', (done) => {
    service
      .translateText({
        text: 'text-sample',
        lang: 'lang-sample',
      } as any)
      .subscribe({
        next: (result) => {
          expect(result).toBeDefined();
          done();
        },
        error: done,
      });
  });

  it('should return bad request when required fields are missing for translateText', (done) => {
    service.translateText({} as any).subscribe({
      next: () => done(new Error('Expected error')),
      error: (error) => {
        expect(error).toBeInstanceOf(BadRequestException);
        done();
      },
    });
  });
});
