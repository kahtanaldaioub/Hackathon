import { UserRole } from '../users/schemas/user.schema.js';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AccessTokenPayload extends AuthenticatedUser {
  tokenType: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  tokenType: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}
