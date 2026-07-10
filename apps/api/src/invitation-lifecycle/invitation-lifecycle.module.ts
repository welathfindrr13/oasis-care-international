import { Module } from "@nestjs/common";
import { DbModule } from "@oasis/db";
import { ClerkInvitationVerificationAdapter } from "./clerk-invitation-verification.adapter";
import { InvitationLifecycleResolver } from "./invitation-lifecycle.resolver";
import { InvitationLifecycleService } from "./invitation-lifecycle.service";

@Module({
  imports: [DbModule],
  providers: [
    ClerkInvitationVerificationAdapter,
    InvitationLifecycleResolver,
    InvitationLifecycleService,
  ],
  exports: [InvitationLifecycleService],
})
export class InvitationLifecycleModule {}
