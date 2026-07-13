import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import request from 'supertest';
import {
  applyApiHardening,
  createApiValidationPipe,
  createCompanyAccessRequestRateLimiter,
  getGraphQLSecurityOptions,
} from './api-hardening';

class StrictInput {
  @IsString()
  name!: string;
}

@InputType()
class GraphQLStyleInput {
  @Field()
  name!: string;
}

@Controller('hardening-test')
class HardeningTestController {
  @Get()
  ok() {
    return { ok: true };
  }

  @Post()
  echo(@Body() body: Record<string, unknown>) {
    return body;
  }
}

@Controller()
class ProbeTestController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  ready() {
    return { status: 'ready' };
  }

  @Get('healthz')
  healthz() {
    return { status: 'ok' };
  }
}

@Module({
  controllers: [HardeningTestController, ProbeTestController],
})
class HardeningTestModule {}

describe('API hardening', () => {
  it('disables GraphQL introspection only in production', () => {
    expect(getGraphQLSecurityOptions('production')).toMatchObject({
      introspection: false,
      playground: false,
      parseOptions: { maxTokens: 2_000 },
    });
    expect(getGraphQLSecurityOptions('test')).toMatchObject({
      introspection: true,
      playground: true,
      parseOptions: { maxTokens: 2_000 },
    });
    expect(
      getGraphQLSecurityOptions('production').validationRules,
    ).toHaveLength(1);
  });

  it('enables Helmet headers and disables x-powered-by', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HardeningTestModule],
    }).compile();
    const app = moduleFixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });

    applyApiHardening(app, {
      jsonBodyLimit: '1kb',
      urlencodedBodyLimit: '1kb',
      rateLimit: { windowMs: 60_000, max: 100 },
    });
    await app.init();

    await request(app.getHttpServer())
      .get('/hardening-test')
      .expect(200)
      .expect('x-content-type-options', 'nosniff')
      .expect('x-frame-options', 'DENY')
      .expect((res) => {
        expect(res.headers['x-powered-by']).toBeUndefined();
        expect(res.headers['referrer-policy']).toBe('no-referrer');
      });

    await app.close();
  });

  it('rejects oversized JSON request bodies before controller handling', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HardeningTestModule],
    }).compile();
    const app = moduleFixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });

    applyApiHardening(app, {
      jsonBodyLimit: '1kb',
      urlencodedBodyLimit: '1kb',
      rateLimit: { windowMs: 60_000, max: 100 },
    });
    await app.init();

    await request(app.getHttpServer())
      .post('/hardening-test')
      .send({ note: 'x'.repeat(2_000) })
      .expect(413);

    await app.close();
  });

  it('rate limits repeated requests', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HardeningTestModule],
    }).compile();
    const app = moduleFixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });

    applyApiHardening(app, {
      jsonBodyLimit: '1kb',
      urlencodedBodyLimit: '1kb',
      rateLimit: { windowMs: 60_000, max: 2 },
    });
    await app.init();

    await request(app.getHttpServer()).get('/hardening-test').expect(200);
    await request(app.getHttpServer()).get('/hardening-test').expect(200);
    await request(app.getHttpServer()).get('/hardening-test').expect(429);

    await app.close();
  });

  it('rate limits forwarded clients independently behind one trusted proxy', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HardeningTestModule],
    }).compile();
    const app = moduleFixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });

    app.set('trust proxy', 1);
    applyApiHardening(app, {
      jsonBodyLimit: '1kb',
      urlencodedBodyLimit: '1kb',
      rateLimit: { windowMs: 60_000, max: 2 },
    });
    await app.init();

    await request(app.getHttpServer())
      .get('/hardening-test')
      .set('X-Forwarded-For', '198.51.100.10')
      .expect(200);
    await request(app.getHttpServer())
      .get('/hardening-test')
      .set('X-Forwarded-For', '198.51.100.10')
      .expect(200);
    await request(app.getHttpServer())
      .get('/hardening-test')
      .set('X-Forwarded-For', '203.0.113.20')
      .expect(200);
    await request(app.getHttpServer())
      .get('/hardening-test')
      .set('X-Forwarded-For', '198.51.100.10')
      .expect(429);

    await app.close();
  });

  it('does not rate limit public probe endpoints', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HardeningTestModule],
    }).compile();
    const app = moduleFixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });

    app.set('trust proxy', 1);
    applyApiHardening(app, {
      jsonBodyLimit: '1kb',
      urlencodedBodyLimit: '1kb',
      rateLimit: { windowMs: 60_000, max: 1 },
    });
    await app.init();

    for (const path of ['/health', '/ready', '/healthz']) {
      await request(app.getHttpServer())
        .get(path)
        .set('X-Forwarded-For', '198.51.100.10')
        .expect(200);
      await request(app.getHttpServer())
        .get(path)
        .set('X-Forwarded-For', '198.51.100.10')
        .expect(200);
    }

    await request(app.getHttpServer())
      .get('/hardening-test')
      .set('X-Forwarded-For', '198.51.100.10')
      .expect(200);
    await request(app.getHttpServer())
      .get('/hardening-test')
      .set('X-Forwarded-For', '198.51.100.10')
      .expect(429);

    await app.close();
  });

  it('applies a stricter independent limiter to public company requests', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HardeningTestModule],
    }).compile();
    const app = moduleFixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });

    app.set('trust proxy', 1);
    app.use(
      '/company-access-requests',
      createCompanyAccessRequestRateLimiter({
        COMPANY_ACCESS_REQUEST_RATE_LIMIT_WINDOW_MS: '60000',
        COMPANY_ACCESS_REQUEST_RATE_LIMIT_MAX: '2',
      }),
    );
    applyApiHardening(app, {
      rateLimit: { windowMs: 60_000, max: 100 },
    });
    await app.init();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request(app.getHttpServer())
        .post('/company-access-requests')
        .set('X-Forwarded-For', '198.51.100.10')
        .send({})
        .expect(404);
    }
    await request(app.getHttpServer())
      .post('/company-access-requests')
      .set('X-Forwarded-For', '198.51.100.10')
      .send({})
      .expect(429);
    await request(app.getHttpServer())
      .post('/company-access-requests')
      .set('X-Forwarded-For', '203.0.113.20')
      .send({})
      .expect(404);

    await app.close();
  });

  it('transforms DTO input and returns sanitized validation errors', async () => {
    const pipe = createApiValidationPipe();

    const valid = await pipe.transform(
      { name: 'Ada' },
      { type: 'body', metatype: StrictInput },
    );

    expect(valid).toBeInstanceOf(StrictInput);
    expect(valid).toEqual({ name: 'Ada' });

    await expect(
      pipe.transform(
        { name: 42 },
        { type: 'body', metatype: StrictInput },
      ),
    ).rejects.toThrow(/Validation failed: name: name must be a string/);
  });

  it('does not reject GraphQL-style inputs without validation metadata', async () => {
    const pipe = createApiValidationPipe();

    const value = await pipe.transform(
      { name: 'Ada' },
      { type: 'body', metatype: GraphQLStyleInput },
    );

    expect(value).toBeInstanceOf(GraphQLStyleInput);
    expect(value).toEqual({ name: 'Ada' });
  });
});
