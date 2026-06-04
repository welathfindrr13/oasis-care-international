import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { CarerRepository } from './carer.repository';
import { CarerResolver } from './carer.resolver';
import { CarerService } from './carer.service';

@Module({
  imports: [DbModule],
  providers: [CarerRepository, CarerService, CarerResolver],
  exports: [CarerService],
})
export class CarerModule {}
