import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { vi } from 'vitest';
import { User, UserRole } from '../users/schemas/user.schema.js';
import { hashPassword } from './password-hasher.js';
import { AuthService } from './auth.service.js';
import { AuthSession } from './schemas/auth.schema.js';

describe('AuthService', () => {
  const secret = 'test-secret-that-is-at-least-32-characters-long';
  const email = 'admin@localhost';
  const password = 'correct-test-password';

  async function createService() {
    const user = {
      _id: new Types.ObjectId(),
      email,
      passwordHash: await hashPassword(password),
      role: UserRole.ADMIN,
    };
    const userQuery = {
      select: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(user),
    };
    const usersModel = {
      create: vi.fn().mockImplementation(async (values) => ({
        ...user,
        ...values,
      })),
      findOne: vi.fn().mockReturnValue(userQuery),
      findById: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(user),
      }),
    };

    let storedRefreshHash: string | undefined;
    const sessionsModel = {
      create: vi.fn().mockImplementation(async (session) => {
        storedRefreshHash = session.refreshTokenHash;
        return session;
      }),
      findOneAndUpdate: vi.fn().mockImplementation((filter, update) => ({
        exec: vi.fn().mockImplementation(async () => {
          if (filter.refreshTokenHash !== storedRefreshHash) {
            return null;
          }

          storedRefreshHash = update.$set.refreshTokenHash;
          return {};
        }),
      })),
      deleteOne: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ deletedCount: 1 }),
      }),
    };
    const config = {
      getOrThrow: vi.fn((key: string) => {
        const values: Record<string, string | number> = {
          'jwt.secret': secret,
          'jwt.accessTokenTtlSeconds': 900,
          'jwt.refreshTokenTtlSeconds': 2_592_000,
        };
        return values[key];
      }),
    };
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret })],
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: usersModel },
        {
          provide: getModelToken(AuthSession.name),
          useValue: sessionsModel,
        },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    return {
      authService: module.get(AuthService),
      jwtService: module.get(JwtService),
      module,
      sessionsModel,
      user,
      usersModel,
    };
  }

  it('authenticates credentials and returns signed access and refresh tokens', async () => {
    const { authService, jwtService, module, sessionsModel, usersModel } =
      await createService();

    const result = await authService.login({
      email: ` ${email.toUpperCase()} `,
      password,
    });
    const accessPayload = await jwtService.verifyAsync(result.accessToken, {
      secret,
      algorithms: ['HS256'],
      issuer: 'nest-setup',
      audience: 'nest-setup-api',
    });
    const refreshPayload = await jwtService.verifyAsync(result.refreshToken, {
      secret,
      algorithms: ['HS256'],
      issuer: 'nest-setup',
      audience: 'nest-setup-api',
    });

    expect(usersModel.findOne).toHaveBeenCalledWith({ email });
    expect(accessPayload).toMatchObject({
      email,
      role: UserRole.ADMIN,
      tokenType: 'access',
    });
    expect(refreshPayload).toMatchObject({
      tokenType: 'refresh',
      sub: accessPayload.sub,
    });
    expect(sessionsModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshTokenHash: expect.any(String),
      }),
    );
    expect(result.user).toMatchObject({ email, role: UserRole.ADMIN });
    await module.close();
  });

  it('registers a regular user and issues a token pair', async () => {
    const { authService, module, sessionsModel, usersModel } =
      await createService();

    const result = await authService.register({
      email: ' NewUser@example.com ',
      password: 'a-secure-password',
    });

    expect(usersModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newuser@example.com',
        passwordHash: expect.any(String),
        role: UserRole.USER,
      }),
    );
    expect(result.user.role).toBe(UserRole.USER);
    expect(sessionsModel.create).toHaveBeenCalledOnce();
    await module.close();
  });

  it('rejects registration when the email is already in use', async () => {
    const { authService, module, usersModel } = await createService();
    usersModel.create.mockRejectedValue({ code: 11000 });

    await expect(authService.register({ email, password })).rejects.toThrow(
      'Email is already registered',
    );
    await module.close();
  });

  it('rotates refresh tokens and rejects reuse of a rotated token', async () => {
    const { authService, module } = await createService();
    const initialTokens = await authService.login({ email, password });

    const rotatedTokens = await authService.refresh(initialTokens.refreshToken);

    expect(rotatedTokens.refreshToken).not.toBe(initialTokens.refreshToken);
    await expect(
      authService.refresh(initialTokens.refreshToken),
    ).rejects.toThrow('already-used refresh token');
    await module.close();
  });

  it('rejects invalid credentials', async () => {
    const { authService, module } = await createService();

    await expect(
      authService.login({ email, password: 'wrong-password' }),
    ).rejects.toThrow('Invalid email or password');
    await module.close();
  });
});
