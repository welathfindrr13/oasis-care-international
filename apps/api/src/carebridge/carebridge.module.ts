import { Module } from '@nestjs/common';
import { DbModule, PrismaService } from '@oasis/db';
import { CarebridgeRepository } from './carebridge.repository';
import { CarebridgeService } from './carebridge.service';
import { CarebridgeResolver } from './carebridge.resolver';
import { CarebridgeAccessService } from './access/carebridge-access.service';
import { CarebridgeFeedService } from './feed/carebridge-feed.service';
import { CarebridgeConcernService } from './concern/carebridge-concern.service';
import { CarerModule } from '../carer/carer.module';
import { InvitationLifecycleModule } from '../invitation-lifecycle/invitation-lifecycle.module';
import { FamilyInvitationService } from './family-invitation.service';

@Module({
  imports: [DbModule, CarerModule, InvitationLifecycleModule],
  providers: [
    PrismaService,
    CarebridgeRepository,
    CarebridgeService,
    CarebridgeResolver,
    CarebridgeAccessService,
    CarebridgeFeedService,
    CarebridgeConcernService,
    FamilyInvitationService,
  ],
  exports: [CarebridgeService, CarebridgeAccessService, CarebridgeFeedService, CarebridgeConcernService, FamilyInvitationService],
})
export class CarebridgeModule {}
