import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isEmail } from 'class-validator';
import { Model } from 'mongoose';
import { hashPassword } from '../auth/password-hasher.js';
import { User, UserRole } from './schemas/user.schema.js';

@Injectable()
export class DefaultAdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(DefaultAdminSeeder.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config
      .getOrThrow<string>('admin.email')
      .trim()
      .toLowerCase();

    if (!isEmail(email, { require_tld: false })) {
      throw new Error('DEFAULT_ADMIN_EMAIL must contain a valid email address');
    }

    const existingUser = await this.users.findOne({ email }).exec();
    if (existingUser) {
      if (existingUser.role !== UserRole.ADMIN) {
        throw new Error(
          'DEFAULT_ADMIN_EMAIL is already used by a non-admin account',
        );
      }

      return;
    }

    const password = this.config.get<string>('admin.password');
    if (!password || password.length < 12) {
      throw new Error(
        'Set DEFAULT_ADMIN_PASSWORD to a value at least 12 characters long to create the default admin',
      );
    }

    try {
      await this.users.create({
        email,
        passwordHash: await hashPassword(password),
        role: UserRole.ADMIN,
      });
      this.logger.log('Created the default admin account');
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const createdByAnotherInstance = await this.users
        .findOne({ email })
        .exec();
      if (createdByAnotherInstance?.role === UserRole.ADMIN) {
        return;
      }

      throw error;
    }
  }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
