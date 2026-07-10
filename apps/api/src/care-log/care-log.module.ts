import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { CareLogRepository } from './care-log.repository';
import { CareLogService } from './care-log.service';
import { CareLogResolver } from './care-log.resolver';
import { CarerModule } from '../carer/carer.module';

@Module({
  imports: [DbModule, CarerModule],
  providers: [CareLogRepository, CareLogService, CareLogResolver],
  exports: [CareLogService],
})
export class CareLogModule {}
