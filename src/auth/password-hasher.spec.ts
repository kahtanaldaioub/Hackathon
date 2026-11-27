import { verifyPassword, hashPassword } from './password-hasher.js';

describe('password hashing', () => {
  it('verifies a password against its scrypt hash', async () => {
    const hash = await hashPassword('a-secure-password');

    await expect(verifyPassword('a-secure-password', hash)).resolves.toBe(true);
    await expect(verifyPassword('another-password', hash)).resolves.toBe(false);
    await expect(verifyPassword('a-secure-password', 'invalid')).resolves.toBe(
      false,
    );
  });
});
