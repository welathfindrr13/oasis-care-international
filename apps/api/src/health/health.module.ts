import { Module } from '@nestjs/common';
import { HealthController, DemoController } from './health.controller';

@Module({
  controllers: [HealthController, DemoController],
})
export class HealthModule {}
