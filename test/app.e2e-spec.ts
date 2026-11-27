import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
  });
});
