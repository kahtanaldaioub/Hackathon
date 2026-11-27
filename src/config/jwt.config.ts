import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters');
  }

  const accessTokenTtlSeconds = Number(
    process.env.JWT_ACCESS_TTL_SECONDS ?? 900,
  );
  const refreshTokenTtlSeconds = Number(
    process.env.JWT_REFRESH_TTL_SECONDS ?? 2_592_000,
  );

  if (
    !Number.isInteger(accessTokenTtlSeconds) ||
    accessTokenTtlSeconds < 1 ||
    !Number.isInteger(refreshTokenTtlSeconds) ||
    refreshTokenTtlSeconds <= accessTokenTtlSeconds
  ) {
    throw new Error(
      'JWT token lifetimes must be positive integers, with refresh longer than access',
    );
  }

  return {
    secret,
    accessTokenTtlSeconds,
    refreshTokenTtlSeconds,
  };
});
