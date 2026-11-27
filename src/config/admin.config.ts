import { registerAs } from '@nestjs/config';

export default registerAs('admin', () => ({
  email: process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@localhost',
  password: process.env.DEFAULT_ADMIN_PASSWORD,
}));
