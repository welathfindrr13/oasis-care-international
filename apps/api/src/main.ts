import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { GraphqlExceptionFilter } from './common/filters/gql-exception.filter';
import { GqlErrorFilter } from './common/filters/gql-error.filter';
import { BaseHttpException } from './common/errors/base-http.exception';
import { ErrorCode } from './common/errors/error-codes';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { PrismaService } from '@oasis/db';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend
  const origins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  // Global exception filters
  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new GraphqlExceptionFilter(),
    new GqlErrorFilter(),
  );

  // Global validation pipe with custom error factory
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: () =>
        new BaseHttpException(
          ErrorCode.VALIDATION_FAILED,
          'Validation failed',
          HttpStatus.BAD_REQUEST,
        ),
    }),
  );

  // Global audit logging interceptor (with PII masking)
  const prismaService = app.get(PrismaService);
  app.useGlobalInterceptors(new AuditLogInterceptor(prismaService));

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on 0.0.0.0:${port}`);
}
bootstrap();
