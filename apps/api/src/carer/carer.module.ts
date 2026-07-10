import { Module } from "@nestjs/common";
import { DbModule } from "@oasis/db";
import { CarerRepository } from "./carer.repository";
import { CarerAccessService } from "./carer-access.service";
import { CarerResolver } from "./carer.resolver";
import { CarerService } from "./carer.service";
import { CarerMembershipService } from "./carer-membership.service";
import { InvitationLifecycleModule } from "../invitation-lifecycle/invitation-lifecycle.module";
import { CarerInvitationService } from "./carer-invitation.service";

@Module({
  imports: [DbModule, InvitationLifecycleModule],
  providers: [
    CarerRepository,
    CarerAccessService,
    CarerInvitationService,
    CarerMembershipService,
    CarerService,
    CarerResolver,
  ],
  exports: [CarerAccessService, CarerMembershipService, CarerService],
})
export class CarerModule {}
