import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { HealthController, DemoController, StandardHealthController } from './health.controller';

@Module({
  imports: [DbModule],
  controllers: [HealthController, DemoController, StandardHealthController],
})
export class HealthModule {}
