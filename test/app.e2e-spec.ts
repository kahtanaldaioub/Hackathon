import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { vi } from 'vitest';
import { AppModule } from './../src/app.module.js';
import { User } from './../src/users/schemas/user.schema.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    vi.stubEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017/nest-setup-test');
    vi.stubEnv('OBSERVE_APP_KEY', '');
    vi.stubEnv('OBSERVE_APP_SECRET', '');

    const userModel = {
      findOne: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ role: 'admin' }),
      }),
    };
    const connection = {
      close: vi.fn().mockResolvedValue(undefined),
    };

    const moduleBuilder = Test.createTestingModule({
      imports: [AppModule],
    });

    moduleBuilder.overrideProvider(getConnectionToken()).useValue(connection);
    moduleBuilder
      .overrideProvider(getModelToken(User.name))
      .useValue(userModel);

    const moduleFixture: TestingModule = await moduleBuilder.compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('rejects fields not declared in a DTO', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({ unexpected: 'value' })
      .expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      path: '/users',
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
});
