import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { DefaultAdminSeeder } from './default-admin.seeder.js';
import { User, UserRole } from './schemas/user.schema.js';

describe('DefaultAdminSeeder', () => {
  const email = 'admin@localhost';
  const password = 'a-secure-local-password';

  async function createSeeder(
    existingUser: { role: UserRole } | null,
    adminPassword?: string,
  ) {
    const query = {
      exec: vi.fn().mockResolvedValue(existingUser),
    };
    const usersModel = {
      findOne: vi.fn().mockReturnValue(query),
      create: vi.fn().mockResolvedValue(undefined),
    };
    const config = {
      getOrThrow: vi.fn().mockReturnValue(email),
      get: vi.fn().mockReturnValue(adminPassword),
    };
    const module = await Test.createTestingModule({
      providers: [
        DefaultAdminSeeder,
        { provide: getModelToken(User.name), useValue: usersModel },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    return {
      module,
      seeder: module.get(DefaultAdminSeeder),
      usersModel,
    };
  }

  it('creates an admin with a one-way password hash', async () => {
    const { module, seeder, usersModel } = await createSeeder(null, password);

    await seeder.onApplicationBootstrap();

    expect(usersModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email,
        role: UserRole.ADMIN,
        passwordHash: expect.stringMatching(/^scrypt\$16384\$8\$1\$/),
      }),
    );
    expect(usersModel.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: password }),
    );
    await module.close();
  });

  it('does not recreate an existing admin', async () => {
    const { module, seeder, usersModel } = await createSeeder({
      role: UserRole.ADMIN,
    });

    await seeder.onApplicationBootstrap();

    expect(usersModel.create).not.toHaveBeenCalled();
    await module.close();
  });

  it('requires a configured password when the admin does not exist', async () => {
    const { module, seeder, usersModel } = await createSeeder(null);

    await expect(seeder.onApplicationBootstrap()).rejects.toThrow(
      'DEFAULT_ADMIN_PASSWORD',
    );
    expect(usersModel.create).not.toHaveBeenCalled();
    await module.close();
  });
});
