import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Masker } from '../common/utils/masker';

@Module({})
export class LoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        pinoHttp({
          genReqId: () => randomUUID(),
          redact: {
            paths: [
              'req.headers.authorization',
              'req.body.password',
              'req.body.email',
              'req.body.phone',
              'res.headers["set-cookie"]',
            ],
            censor: '[REDACTED]',
          },
          transport:
            process.env.NODE_ENV === 'development'
              ? {
                  target: 'pino-pretty',
                  options: { colorize: true, translateTime: true },
                }
              : undefined,
          messageKey: 'message',
          customLogLevel(_req: Request, res: Response, err?: Error) {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
          },
          hooks: {
            logMethod(args: any[], method: any) {
              args[0] = Masker.mask(args[0]); // double-redact
              method.apply(this, args);
            },
          },
        }),
      )
      .forRoutes('*');
  }
}
