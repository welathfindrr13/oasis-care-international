import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { MedicationService } from './medication.service';
import { MedicationResolver } from './medication.resolver';
import { MedicationRepository } from './medication.repository';
import { PrismaService } from '@oasis/db';
import { MetricsModule } from '../metrics/metrics.module';
import { Counter, register } from 'prom-client';
import { CarerModule } from '../carer/carer.module';
import { MedicationLaunchGuard } from './medication-launch.guard';

const medicationAdministrationsTotal = new Counter({
  name: 'medication_administrations_total',
  help: 'Total number of medication administrations recorded',
});

const medicationOverlapsTotal = new Counter({
  name: 'medication_overlaps_total',
  help: 'Total number of medication administration overlap conflicts',
});

register.registerMetric(medicationAdministrationsTotal);
register.registerMetric(medicationOverlapsTotal);

@Module({
  imports: [ClsModule, MetricsModule, CarerModule],
  providers: [
    MedicationService,
    MedicationResolver,
    MedicationRepository,
    MedicationLaunchGuard,
    PrismaService,
    {
      provide: 'medication_administrations_total',
      useValue: medicationAdministrationsTotal,
    },
    {
      provide: 'medication_overlaps_total',
      useValue: medicationOverlapsTotal,
    },
  ],
  exports: [MedicationService, MedicationRepository],
})
export class MedicationModule {}
