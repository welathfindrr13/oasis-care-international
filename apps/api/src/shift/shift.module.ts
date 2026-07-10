import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { ShiftRepository } from './shift.repository';
import { ShiftService } from './shift.service';
import { ShiftResolver } from './shift.resolver';
import { CarerModule } from '../carer/carer.module';

@Module({
  imports: [DbModule, CarerModule],
  providers: [ShiftRepository, ShiftService, ShiftResolver],
  exports: [ShiftService],
})
export class ShiftModule {}
