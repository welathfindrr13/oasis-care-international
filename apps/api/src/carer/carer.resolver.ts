import { Resolver, Query, Mutation, Args, Context } from "@nestjs/graphql";
import { SetMetadata, UseGuards } from "@nestjs/common";
import { GqlRolesGuard } from "../auth/gql-roles.guard";
import { CarerDTO } from "./dto/carer.dto";
import { CarerService } from "./carer.service";
import { LegacyOperationalSurface } from "../auth/legacy-operational-access";
import { CarerMembershipService } from "./carer-membership.service";
import {
  EligibleCarerMembershipDTO,
  LinkedCarerDTO,
} from "./dto/carer-membership.dto";
import { CreateLinkedCarerInput } from "./dto/create-linked-carer.input";
import { CarerInvitationService } from "./carer-invitation.service";
import {
  CarerAccessLifecycleDTO,
  CarerInvitationActionInput,
  CarerMembershipActionInput,
  InviteCarerInput,
} from "./dto/carer-invitation.dto";

const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata("roles", roles);

@Resolver(() => CarerDTO)
@UseGuards(GqlRolesGuard)
@LegacyOperationalSurface()
export class CarerResolver {
  constructor(
    private readonly carerService: CarerService,
    private readonly carerMembershipService: CarerMembershipService,
    private readonly carerInvitationService: CarerInvitationService,
  ) {}

  @Query(() => [CarerDTO])
  @Roles("admin")
  async carers(@Context() ctx: any): Promise<CarerDTO[]> {
    const organizationId = ctx?.req?.user?.organizationId;
    return this.carerService.findCarers(organizationId);
  }

  @Query(() => [EligibleCarerMembershipDTO])
  @Roles("admin")
  async eligibleCarerMemberships(
    @Context() ctx: any,
  ): Promise<EligibleCarerMembershipDTO[]> {
    return this.carerMembershipService.listEligibleMemberships({
      organizationId: ctx?.req?.user?.organizationId,
      organizationMembershipId: ctx?.req?.user?.organizationMembershipId,
      authSubject: ctx?.req?.user?.sub || ctx?.req?.user?.id,
    });
  }

  @Query(() => [CarerAccessLifecycleDTO])
  @Roles("admin")
  async carerAccessLifecycle(
    @Context() ctx: any,
  ): Promise<CarerAccessLifecycleDTO[]> {
    return this.carerInvitationService.list(this.adminPrincipal(ctx));
  }

  @Mutation(() => CarerAccessLifecycleDTO)
  @Roles("admin")
  async inviteCarer(
    @Args("input") input: InviteCarerInput,
    @Context() ctx: any,
  ): Promise<CarerAccessLifecycleDTO> {
    return this.carerInvitationService.invite(
      input.emailAddress,
      this.adminPrincipal(ctx),
    );
  }

  @Mutation(() => CarerAccessLifecycleDTO)
  @Roles("admin")
  async revokeCarerInvitation(
    @Args("input") input: CarerInvitationActionInput,
    @Context() ctx: any,
  ): Promise<CarerAccessLifecycleDTO> {
    return this.carerInvitationService.revokeInvitation(
      input.invitationId,
      this.adminPrincipal(ctx),
    );
  }

  @Mutation(() => CarerAccessLifecycleDTO)
  @Roles("admin")
  async reissueCarerInvitation(
    @Args("input") input: CarerInvitationActionInput,
    @Context() ctx: any,
  ): Promise<CarerAccessLifecycleDTO> {
    return this.carerInvitationService.reissue(
      input.invitationId,
      this.adminPrincipal(ctx),
    );
  }

  @Mutation(() => CarerAccessLifecycleDTO)
  @Roles("admin")
  async retryCarerInvitationDelivery(
    @Args("input") input: CarerInvitationActionInput,
    @Context() ctx: any,
  ): Promise<CarerAccessLifecycleDTO> {
    return this.carerInvitationService.retryDelivery(
      input.invitationId,
      this.adminPrincipal(ctx),
    );
  }

  @Mutation(() => CarerAccessLifecycleDTO)
  @Roles("admin")
  async deactivateCarerMembership(
    @Args("input") input: CarerMembershipActionInput,
    @Context() ctx: any,
  ): Promise<CarerAccessLifecycleDTO> {
    return this.carerInvitationService.deactivateMembership(
      input.membershipId,
      this.adminPrincipal(ctx),
    );
  }

  @Mutation(() => LinkedCarerDTO)
  @Roles("admin")
  async createAndLinkCarer(
    @Args("input") input: CreateLinkedCarerInput,
    @Context() ctx: any,
  ): Promise<LinkedCarerDTO> {
    return this.carerMembershipService.createAndLinkCarer(input, {
      organizationId: ctx?.req?.user?.organizationId,
      organizationMembershipId: ctx?.req?.user?.organizationMembershipId,
      authSubject: ctx?.req?.user?.sub || ctx?.req?.user?.id,
    });
  }

  private adminPrincipal(ctx: any) {
    return {
      organizationId: ctx?.req?.user?.organizationId,
      organizationMembershipId: ctx?.req?.user?.organizationMembershipId,
      authSubject: ctx?.req?.user?.sub || ctx?.req?.user?.id,
    };
  }
}
