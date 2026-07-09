import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { PrismaService } from '@oasis/db';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  applyApiHardening,
  createApiValidationPipe,
} from './security/api-hardening';

async function bootstrap() {
  console.log('>>> BOOTSTRAP START');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  console.log('>>> APP CREATED');

  // Caddy is the single public reverse-proxy hop in production.
  app.set('trust proxy', 1);

  // Enable CORS for frontend
  const origins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  applyApiHardening(app);

  // Global exception filters
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(createApiValidationPipe());

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
