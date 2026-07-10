import { UseGuards } from "@nestjs/common";
import { Args, Context, Mutation, Resolver } from "@nestjs/graphql";
import { GqlJwtAuthGuard } from "../auth/gql-jwt-auth.guard";
import { ManualAudit } from "../common/decorators/manual-audit.decorator";
import {
  InvitationActivationInputDTO,
  InvitationActivationResultDTO,
} from "./invitation-lifecycle.dto";
import { InvitationLifecycleService } from "./invitation-lifecycle.service";

@Resolver(() => InvitationActivationResultDTO)
@UseGuards(GqlJwtAuthGuard)
export class InvitationLifecycleResolver {
  constructor(private readonly invitations: InvitationLifecycleService) {}

  @Mutation(() => InvitationActivationResultDTO)
  @ManualAudit()
  activateViewerOrganizationInvitation(
    @Args("input") input: InvitationActivationInputDTO,
    @Context() context: any,
  ): Promise<InvitationActivationResultDTO> {
    return this.invitations.activateViewerInvitation(
      context?.req?.user,
      input.invitationId,
    );
  }
}
