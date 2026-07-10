import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { CarerRepository } from './carer.repository';
import { CarerAccessService } from './carer-access.service';
import { CarerResolver } from './carer.resolver';
import { CarerService } from './carer.service';
import { CarerMembershipService } from './carer-membership.service';

@Module({
  imports: [DbModule],
  providers: [CarerRepository, CarerAccessService, CarerMembershipService, CarerService, CarerResolver],
  exports: [CarerAccessService, CarerMembershipService, CarerService],
})
export class CarerModule {}
