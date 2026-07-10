import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { ClientService } from './client.service';
import { ClientRepository } from './client.repository';
import { ClientResolver } from './client.resolver';
import { CarerModule } from '../carer/carer.module';

@Module({
  imports: [DbModule, CarerModule],
  providers: [ClientService, ClientRepository, ClientResolver],
  exports: [ClientService],
})
export class ClientModule {}
