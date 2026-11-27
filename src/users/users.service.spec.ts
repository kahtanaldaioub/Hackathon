import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { vi } from 'vitest';
import { User, UserRole } from './schemas/user.schema.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  const user = {
    _id: new Types.ObjectId(),
    email: 'user@example.com',
    role: UserRole.USER,
    passwordHash: 'secret-hash',
  };
  const usersModel = {
    create: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: usersModel },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('creates users with a password hash and returns no password data', async () => {
    usersModel.create.mockImplementation(async (values) => ({
      ...user,
      ...values,
    }));

    const result = await service.create({
      email: ' USER@example.com ',
      password: 'a-secure-password',
    });

    expect(usersModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        passwordHash: expect.any(String),
        role: UserRole.USER,
      }),
    );
    expect(result).toEqual({
      id: user._id.toString(),
      email: 'user@example.com',
      role: UserRole.USER,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rejects invalid Mongo user ids', async () => {
    await expect(service.findOne('not-an-object-id')).rejects.toThrow(
      'Invalid user id',
    );
  });

  it('lists users without selecting password hashes', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([user]),
    };
    usersModel.find.mockReturnValue(query);

    await expect(service.findAll()).resolves.toEqual([
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    ]);
    expect(query.select).toHaveBeenCalledWith('_id email role');
  });

  it('updates user data and hashes a new password', async () => {
    const updatedUser = { ...user, email: 'updated@example.com' };
    const query = {
      select: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(updatedUser),
    };
    usersModel.findByIdAndUpdate.mockReturnValue(query);

    await expect(
      service.update(user._id.toString(), {
        email: updatedUser.email,
        password: 'a-different-password',
      }),
    ).resolves.toMatchObject({
      id: user._id.toString(),
      email: updatedUser.email,
      role: UserRole.USER,
    });

    const [, update, options] = usersModel.findByIdAndUpdate.mock.calls[0] as [
      Types.ObjectId,
      { $set: { passwordHash: string } },
      { new: boolean; runValidators: boolean },
    ];
    expect(update.$set.passwordHash).not.toBe('a-different-password');
    expect(options).toEqual({ new: true, runValidators: true });
  });

  it('deletes an existing user', async () => {
    usersModel.deleteOne.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    });

    await expect(service.remove(user._id.toString())).resolves.toBeUndefined();
    expect(usersModel.deleteOne).toHaveBeenCalledWith({ _id: user._id });
  });
});
