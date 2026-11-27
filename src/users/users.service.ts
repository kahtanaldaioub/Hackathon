import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { hashPassword } from '../auth/password-hasher.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User, UserRole, type UserDocument } from './schemas/user.schema.js';

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  async create(createUserDto: CreateUserDto): Promise<PublicUser> {
    try {
      const user = await this.users.create({
        email: createUserDto.email.trim().toLowerCase(),
        passwordHash: await hashPassword(createUserDto.password),
        role: createUserDto.role ?? UserRole.USER,
      });
      return toPublicUser(user);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async findAll(): Promise<PublicUser[]> {
    const users = await this.users.find().select('_id email role').exec();
    return users.map(toPublicUser);
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.users
      .findById(toObjectId(id))
      .select('_id email role')
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toPublicUser(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<PublicUser> {
    const updates: {
      email?: string;
      passwordHash?: string;
      role?: UserRole;
    } = {};
    if (updateUserDto.email !== undefined) {
      updates.email = updateUserDto.email.trim().toLowerCase();
    }
    if (updateUserDto.password !== undefined) {
      updates.passwordHash = await hashPassword(updateUserDto.password);
    }
    if (updateUserDto.role !== undefined) {
      updates.role = updateUserDto.role;
    }

    try {
      const user = await this.users
        .findByIdAndUpdate(
          toObjectId(id),
          { $set: updates },
          {
            new: true,
            runValidators: true,
          },
        )
        .select('_id email role')
        .exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }
      return toPublicUser(user);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.users.deleteOne({ _id: toObjectId(id) }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('User not found');
    }
  }
}

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException('Invalid user id');
  }
  return new Types.ObjectId(id);
}

function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  };
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
