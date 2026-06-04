import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { ShiftRepository } from './shift.repository';
import { ShiftService } from './shift.service';
import { ShiftResolver } from './shift.resolver';

@Module({
  imports: [DbModule],
  providers: [ShiftRepository, ShiftService, ShiftResolver],
  exports: [ShiftService],
})
export class ShiftModule {}
