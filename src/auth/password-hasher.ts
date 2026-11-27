import { randomBytes, scrypt } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);

  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(
        `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString('hex')}$${key.toString('hex')}`,
      );
    });
  });
}
