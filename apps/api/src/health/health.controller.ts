import { Controller, Get } from '@nestjs/common';

@Controller('healthz')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}

@Controller()
export class StandardHealthController {
  @Get('health')
  standardHealth() {
    return { status: 'ok' };
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
