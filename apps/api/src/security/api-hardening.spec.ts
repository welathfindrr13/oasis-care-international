import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IsString } from 'class-validator';
import request from 'supertest';
import {
  applyApiHardening,
  createApiValidationPipe,
  getGraphQLSecurityOptions,
} from './api-hardening';

class StrictInput {
  @IsString()
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

@Module({
  controllers: [HardeningTestController],
})
class HardeningTestModule {}

describe('API hardening', () => {
  it('disables GraphQL introspection only in production', () => {
    expect(getGraphQLSecurityOptions('production')).toEqual({
      introspection: false,
      playground: false,
    });
    expect(getGraphQLSecurityOptions('test')).toEqual({
      introspection: true,
      playground: true,
    });
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
});
