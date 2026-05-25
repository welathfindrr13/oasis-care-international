import { Controller, Get } from '@nestjs/common';

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
export class HealthController {
  @Get()
  health() {
    return healthPayload();
  }
}

@Controller()
export class StandardHealthController {
  @Get('health')
  standardHealth() {
    return healthPayload();
  }
}

@Controller('demo')
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
