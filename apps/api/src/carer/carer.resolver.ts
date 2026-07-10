import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { SetMetadata, UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../auth/gql-roles.guard';
import { CarerDTO } from './dto/carer.dto';
import { CarerService } from './carer.service';
import { UpsertCarerInput } from './dto/upsert-carer.input';
import { LegacyOperationalSurface } from '../auth/legacy-operational-access';
import { CarerMembershipService } from './carer-membership.service';
import { EligibleCarerMembershipDTO, LinkedCarerDTO } from './dto/carer-membership.dto';
import { CreateLinkedCarerInput } from './dto/create-linked-carer.input';

const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata('roles', roles);

@Resolver(() => CarerDTO)
@UseGuards(GqlRolesGuard)
@LegacyOperationalSurface()
export class CarerResolver {
  constructor(
    private readonly carerService: CarerService,
    private readonly carerMembershipService: CarerMembershipService,
  ) {}

  @Query(() => [CarerDTO])
  @Roles('admin')
  async carers(@Context() ctx: any): Promise<CarerDTO[]> {
    const organizationId = ctx?.req?.user?.organizationId;
    return this.carerService.findCarers(organizationId);
  }

  @Mutation(() => CarerDTO)
  @Roles('admin')
  async upsertCarer(@Args('input') input: UpsertCarerInput, @Context() ctx: any): Promise<CarerDTO> {
    const organizationId = ctx?.req?.user?.organizationId;
    return this.carerService.upsertCarer(input, organizationId);
  }

  @Query(() => [EligibleCarerMembershipDTO])
  @Roles('admin')
  async eligibleCarerMemberships(@Context() ctx: any): Promise<EligibleCarerMembershipDTO[]> {
    return this.carerMembershipService.listEligibleMemberships({
      organizationId: ctx?.req?.user?.organizationId,
      organizationMembershipId: ctx?.req?.user?.organizationMembershipId,
      authSubject: ctx?.req?.user?.sub || ctx?.req?.user?.id,
    });
  }

  @Mutation(() => LinkedCarerDTO)
  @Roles('admin')
  async createAndLinkCarer(
    @Args('input') input: CreateLinkedCarerInput,
    @Context() ctx: any,
  ): Promise<LinkedCarerDTO> {
    return this.carerMembershipService.createAndLinkCarer(input, {
      organizationId: ctx?.req?.user?.organizationId,
      organizationMembershipId: ctx?.req?.user?.organizationMembershipId,
      authSubject: ctx?.req?.user?.sub || ctx?.req?.user?.id,
    });
  }
}
