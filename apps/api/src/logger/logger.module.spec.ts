import { Controller, Get, INestApplication, Module, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { ClsModule, ClsService } from 'nestjs-cls';
import request from 'supertest';
import { LoggerModule } from './logger.module';

@Controller()
class LoggerTestController {
  constructor(private readonly cls: ClsService) {}

  @Get()
  root(@Req() req: Request) {
    return this.context(req);
  }

  @Get('nested/route')
  nested(@Req() req: Request) {
    return this.context(req);
  }

  private context(req: Request) {
    return {
      headerRequestId: req.headers['x-request-id'],
      requestId: this.cls.get('requestId'),
    };
  }
}

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls) => cls.set('requestId', 'cls-request-id'),
      },
    }),
    LoggerModule,
  ],
  controllers: [LoggerTestController],
})
class LoggerTestModule {}

describe('LoggerModule', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LoggerTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['/', '/nested/route'])(
    'runs CLS and request logging middleware for %s',
    async (path) => {
      const response = await request(app.getHttpServer())
        .get(path)
        .set('x-request-id', 'client-request-id')
        .expect(200);

      expect(response.body).toEqual({
        headerRequestId: 'client-request-id',
        requestId: 'cls-request-id',
      });
    },
  );
});
