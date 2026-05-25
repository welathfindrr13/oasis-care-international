import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { CareLogRepository } from './care-log.repository';
import { CareLogService } from './care-log.service';
import { CareLogResolver } from './care-log.resolver';

@Module({
  imports: [DbModule],
  providers: [CareLogRepository, CareLogService, CareLogResolver],
  exports: [CareLogService],
})
export class CareLogModule {}
