import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  it('is defined', async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: vi.fn(),
            refresh: vi.fn(),
            logout: vi.fn(),
          },
        },
      ],
    }).compile();

    expect(module.get(AuthController)).toBeDefined();
    await module.close();
  });
});
