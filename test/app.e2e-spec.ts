import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { AuthSession } from './../src/auth/schemas/auth.schema.js';
import { User, UserRole } from './../src/users/schemas/user.schema.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    vi.stubEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017/nest-setup-test');
    vi.stubEnv('OBSERVE_APP_KEY', '');
    vi.stubEnv('OBSERVE_APP_SECRET', '');
    vi.stubEnv(
      'JWT_SECRET',
      'test-only-secret-that-is-at-least-32-characters-long',
    );

    const userModel = {
      findOne: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ role: 'admin' }),
      }),
    };
    const connection = {
      readyState: 1,
      db: {
        command: vi.fn().mockResolvedValue({ ok: 1 }),
      },
      close: vi.fn().mockResolvedValue(undefined),
    };
    const authSessionModel = {};

    const moduleBuilder = Test.createTestingModule({
      imports: [AppModule],
    });

    moduleBuilder.overrideProvider(getConnectionToken()).useValue(connection);
    moduleBuilder
      .overrideProvider(getModelToken(User.name))
      .useValue(userModel);
    moduleBuilder
      .overrideProvider(getModelToken(AuthSession.name))
      .useValue(authSessionModel);

    const moduleFixture: TestingModule = await moduleBuilder.compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('checks application and MongoDB health', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.details.database.status).toBe('up');
  });

  it('requires an access token for user management', () => {
    return request(app.getHttpServer()).get('/api/users').expect(401);
  });

  it('rejects regular users from user management', async () => {
    const accessToken = await createAccessToken(UserRole.USER);

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('rejects fields not declared in a DTO', async () => {
    const accessToken = await createAccessToken(UserRole.ADMIN);

    const response = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ unexpected: 'value' })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      path: '/api/users',
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  async function createAccessToken(role: UserRole): Promise<string> {
    return app.get(JwtService).signAsync(
      {
        sub: new Types.ObjectId().toString(),
        email: 'admin@localhost',
        role,
        tokenType: 'access',
      },
      {
        expiresIn: 900,
        issuer: 'nest-setup',
        audience: 'nest-setup-api',
        algorithm: 'HS256',
      },
    );
  }
});
