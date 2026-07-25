import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '@oasis/db';
import { Public } from '../auth/public.decorator';

function healthPayload() {
  const environment =
    process.env.APP_ENVIRONMENT ||
    process.env.ENVIRONMENT ||
    process.env.STAGE ||
    process.env.NODE_ENV ||
    'development';

  return {
    status: 'ok',
    version: process.env.APP_VERSION || process.env.VERSION || 'unknown',
    commitSha: process.env.APP_COMMIT_SHA || process.env.COMMIT_SHA || 'unknown',
    environment,
  };
}

@Controller('healthz')
@Public()
export class HealthController {
  @Get()
  health() {
    return healthPayload();
  }
}

@Controller()
@Public()
export class StandardHealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  standardHealth() {
    return healthPayload();
  }

  @Get('ready')
  async readiness() {
    const checks = {
      api: 'ok',
      database: 'unknown',
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    const ready = checks.database === 'ok';
    const payload = {
      ...healthPayload(),
      status: ready ? 'ready' : 'degraded',
      checks,
    };

    if (!ready) {
      throw new ServiceUnavailableException(payload);
    }

    return payload;
  }
}

@Controller('demo')
@Public()
export class DemoController {
  @Get('health')
  demoHealth() {
    return {
      ok: true,
      version: '1.0.0',
      demo_mode: process.env.DEMO_MODE === 'true',
    };
  }
}
