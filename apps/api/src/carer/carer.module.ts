import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { CarerRepository } from './carer.repository';
import { CarerAccessService } from './carer-access.service';
import { CarerResolver } from './carer.resolver';
import { CarerService } from './carer.service';

@Module({
  imports: [DbModule],
  providers: [CarerRepository, CarerAccessService, CarerService, CarerResolver],
  exports: [CarerAccessService, CarerService],
})
export class CarerModule {}
