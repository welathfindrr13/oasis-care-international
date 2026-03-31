import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { CarePlanRepository } from './care-plan.repository';
import { CarePlanResolver } from './care-plan.resolver';
import { CarePlanService } from './care-plan.service';

@Module({
  imports: [DbModule],
  providers: [CarePlanRepository, CarePlanResolver, CarePlanService],
  exports: [CarePlanService],
})
export class CarePlanModule {}
