import { Module } from '@nestjs/common';
import { DbModule } from '@oasis/db';
import { ClientService } from './client.service';
import { ClientRepository } from './client.repository';
import { ClientResolver } from './client.resolver';
import { CarerModule } from '../carer/carer.module';
import { CarebridgeModule } from '../carebridge/carebridge.module';

@Module({
  imports: [DbModule, CarerModule, CarebridgeModule],
  providers: [ClientService, ClientRepository, ClientResolver],
  exports: [ClientService],
})
export class ClientModule {}
