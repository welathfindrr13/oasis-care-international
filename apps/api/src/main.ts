import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { GraphqlExceptionFilter } from './common/filters/gql-exception.filter';
import { BaseHttpException } from './common/errors/base-http.exception';
import { ErrorCode } from './common/errors/error-codes';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global exception filters
  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new GraphqlExceptionFilter(),
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

  const port = process.env.PORT || 4000;
  await app.listen(port);
  // console.log removed – use logger
  // console.log removed – use logger
  // console.log removed – use logger
}
bootstrap();
