import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { CarePlanningRepository } from './care-planning.repository';
import { CarePlanningService } from './care-planning.service';
import { CarePlanningResolver } from './care-planning.resolver';
import { CarerModule } from '../carer/carer.module';

@Module({
  imports: [DbModule, CarerModule],
  providers: [CarePlanningRepository, CarePlanningService, CarePlanningResolver],
  exports: [CarePlanningService],
})
export class CarePlanningModule {}
