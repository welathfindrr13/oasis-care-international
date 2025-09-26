import { Module } from '@nestjs/common';
import { HealthController, DemoController, StandardHealthController } from './health.controller';

@Module({
  controllers: [HealthController, DemoController, StandardHealthController],
})
export class HealthModule {}
