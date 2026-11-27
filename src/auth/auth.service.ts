import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Types, type Model } from 'mongoose';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { AuthSession } from './schemas/auth.schema.js';
import {
  User,
  UserRole,
  type UserDocument,
} from '../users/schemas/user.schema.js';
import { hashPassword, verifyPassword } from './password-hasher.js';
import { RefreshTokenPayload, TokenPair } from './auth.types.js';

const JWT_ISSUER = 'nest-setup';
const JWT_AUDIENCE = 'nest-setup-api';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(AuthSession.name)
    private readonly sessions: Model<AuthSession>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(credentials: RegisterDto): Promise<TokenPair> {
    let user: UserDocument;
    try {
      user = await this.users.create({
        email: credentials.email.trim().toLowerCase(),
        passwordHash: await hashPassword(credentials.password),
        role: UserRole.USER,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }

    return this.createSession(user);
  }

  async login(credentials: LoginDto): Promise<TokenPair> {
    const email = credentials.email.trim().toLowerCase();
    const user = await this.users
      .findOne({ email })
      .select('+passwordHash')
      .exec();

    if (
      !user ||
      !(await verifyPassword(credentials.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createSession(user);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.users.findById(payload.sub).exec();
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const sessionId = new Types.ObjectId(payload.sid);
    const tokens = await this.createTokenPair(user, sessionId);
    const currentRefreshTokenHash = hashRefreshToken(refreshToken);
    const session = await this.sessions
      .findOneAndUpdate(
        {
          _id: sessionId,
          userId: user._id,
          refreshTokenHash: currentRefreshTokenHash,
          expiresAt: { $gt: new Date() },
        },
        {
          $set: {
            refreshTokenHash: hashRefreshToken(tokens.refreshToken),
            expiresAt: this.refreshTokenExpiry(),
          },
        },
        { new: true, runValidators: true },
      )
      .exec();

    if (!session) {
      throw new UnauthorizedException('Invalid or already-used refresh token');
    }

    return this.toTokenResponse(user, tokens);
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken);
    await this.sessions
      .deleteOne({
        _id: new Types.ObjectId(payload.sid),
        userId: new Types.ObjectId(payload.sub),
        refreshTokenHash: hashRefreshToken(refreshToken),
      })
      .exec();
  }

  private async createTokenPair(
    user: UserDocument,
    sessionId: Types.ObjectId,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const secret = this.config.getOrThrow<string>('jwt.secret');
    const accessTtl = this.config.getOrThrow<number>(
      'jwt.accessTokenTtlSeconds',
    );
    const refreshTtl = this.config.getOrThrow<number>(
      'jwt.refreshTokenTtlSeconds',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: user._id.toString(),
          email: user.email,
          role: user.role,
          tokenType: 'access',
        },
        {
          secret,
          algorithm: 'HS256',
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          expiresIn: accessTtl,
        },
      ),
      this.jwtService.signAsync(
        {
          sub: user._id.toString(),
          sid: sessionId.toString(),
          tokenType: 'refresh',
        },
        {
          secret,
          algorithm: 'HS256',
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          expiresIn: refreshTtl,
          jwtid: randomUUID(),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async createSession(user: UserDocument): Promise<TokenPair> {
    const sessionId = new Types.ObjectId();
    const tokens = await this.createTokenPair(user, sessionId);

    await this.sessions.create({
      _id: sessionId,
      userId: user._id,
      refreshTokenHash: hashRefreshToken(tokens.refreshToken),
      expiresAt: this.refreshTokenExpiry(),
    });

    return this.toTokenResponse(user, tokens);
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('jwt.secret'),
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (
      payload.tokenType !== 'refresh' ||
      !Types.ObjectId.isValid(payload.sub) ||
      !Types.ObjectId.isValid(payload.sid)
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return payload;
  }

  private refreshTokenExpiry(): Date {
    const ttl = this.config.getOrThrow<number>('jwt.refreshTokenTtlSeconds');
    return new Date(Date.now() + ttl * 1000);
  }

  private toTokenResponse(
    user: UserDocument,
    tokens: { accessToken: string; refreshToken: string },
  ): TokenPair {
    return {
      ...tokens,
      tokenType: 'Bearer',
      expiresIn: this.config.getOrThrow<number>('jwt.accessTokenTtlSeconds'),
      refreshExpiresIn: this.config.getOrThrow<number>(
        'jwt.refreshTokenTtlSeconds',
      ),
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  }
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}
