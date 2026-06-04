import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ValidationPipe, HttpStatus, ValidationError } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { BaseHttpException } from './common/errors/base-http.exception';
import { ErrorCode } from './common/errors/error-codes';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { PrismaService } from '@oasis/db';

async function bootstrap() {
  console.log('>>> BOOTSTRAP START');
  const app = await NestFactory.create(AppModule);
  console.log('>>> APP CREATED');

  const httpAdapter = app.getHttpAdapter();
  const httpInstance = httpAdapter.getInstance() as any;
  if (typeof httpInstance?.disable === 'function') {
    httpInstance.disable('x-powered-by');
  }
  app.use((req: any, res: any, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    next();
  });
  
  // Enable CORS for frontend
  const origins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  // Global exception filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe with custom error factory
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: (errors: ValidationError[] = []) => {
        const details = errors
          .flatMap((error) => {
            const constraints = error?.constraints ? Object.values(error.constraints) : [];
            if (!constraints.length) return [];
            return constraints.map((msg) => `${error.property}: ${msg}`);
          })
          .slice(0, 5);

        const message =
          details.length > 0
            ? `Validation failed: ${details.join('; ')}`
            : 'Validation failed';

        return new BaseHttpException(
          ErrorCode.VALIDATION_FAILED,
          message,
          HttpStatus.BAD_REQUEST,
        );
      },
    }),
  );

  // Global audit logging interceptor (with PII masking)
  const prismaService = app.get(PrismaService);
  app.useGlobalInterceptors(new AuditLogInterceptor(prismaService));

  const configService = app.get(ConfigService);
  const configuredPort = configService.get<number>('PORT');
  const port = Number.isFinite(configuredPort) ? Number(configuredPort) : parseInt(process.env.PORT || '3000', 10);
  console.log('>>> ABOUT TO LISTEN ON PORT', port);
  await app.listen(port, '0.0.0.0');
  console.log(`>>> API LISTENING ON 0.0.0.0:${port}`);
}
bootstrap();
