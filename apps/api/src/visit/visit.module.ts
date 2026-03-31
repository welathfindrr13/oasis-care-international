import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { VisitService } from './visit.service';
import { VisitResolver } from './visit.resolver';
import { VisitRepository } from './visit.repository';
import { PrismaService } from '@oasis/db';
import { MedicationModule } from '../medication/medication.module';
import { CarePlanModule } from '../care-plan/care-plan.module';
@Module({
  imports: [ClsModule, MedicationModule, CarePlanModule],
  providers: [
    VisitService,
    VisitResolver,
    VisitRepository,
    PrismaService,
  ],
  exports: [VisitService],
})
export class VisitModule {}
