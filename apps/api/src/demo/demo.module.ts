import { Module } from '@nestjs/common';
import { DemoSeedController } from './demo-seed.controller';
import { PrismaService } from '@oasis/db';

@Module({
  controllers: [DemoSeedController],
  providers: [PrismaService],
})
export class DemoModule {}
