import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../../auth/gql-roles.guard';
import { CarebridgeAccessService } from '../access/carebridge-access.service';
import { getCarebridgeActor } from '../current-user';
import { AccessGrantScope } from '../dto/carebridge.enums';
import { mapConcern } from '../mappers';
import { CarebridgeRoles } from '../roles';
import { AcknowledgeConcernInput } from './dto/acknowledge-concern.input';
import { ConcernDTO } from './dto/concern.dto';
import { RaiseConcernInput } from './dto/raise-concern.input';
import { ResolveConcernInput } from './dto/resolve-concern.input';
import { RespondToConcernInput } from './dto/respond-to-concern.input';
import { CarebridgeConcernService } from './carebridge-concern.service';

@Resolver(() => ConcernDTO)
@UseGuards(GqlRolesGuard)
export class CarebridgeConcernResolver {
  constructor(
    private readonly concernService: CarebridgeConcernService,
    private readonly accessService: CarebridgeAccessService,
  ) {}

  @Mutation(() => ConcernDTO)
  @CarebridgeRoles('user')
  async raiseCareRoomConcern(@Args('input') input: RaiseConcernInput, @Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    const membership = await this.accessService.requireFamilyScopes({
      careRoomId: input.careRoomId,
      organizationId: actor.organizationId || '',
      authSubject: actor.userId,
      email: actor.email,
      requiredScopes: [AccessGrantScope.RAISE_CONCERNS],
    });

    const concern = await this.concernService.raiseConcern({
      ...input,
      organizationId: membership.care_room.organization_id || actor.organizationId,
      raisedByMembershipId: membership.id,
    });
    return mapConcern(concern);
  }

  @Mutation(() => ConcernDTO)
  @CarebridgeRoles('admin', 'carer')
  async acknowledgeCareRoomConcern(@Args('input') input: AcknowledgeConcernInput, @Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    const concern = await this.concernService.acknowledgeConcern({
      concernId: input.concernId,
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
    });
    return mapConcern(concern);
  }

  @Mutation(() => ConcernDTO)
  @CarebridgeRoles('admin', 'carer')
  async respondToCareRoomConcern(@Args('input') input: RespondToConcernInput, @Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    const concern = await this.concernService.respondToConcern({
      concernId: input.concernId,
      body: input.body,
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
    });
    return mapConcern(concern);
  }

  @Mutation(() => ConcernDTO)
  @CarebridgeRoles('admin', 'carer')
  async resolveCareRoomConcern(@Args('input') input: ResolveConcernInput, @Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    const concern = await this.concernService.resolveConcern({
      concernId: input.concernId,
      outcome: input.outcome,
      resolutionSummary: input.resolutionSummary,
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
    });
    return mapConcern(concern);
  }

  @Query(() => [ConcernDTO])
  @CarebridgeRoles('user')
  async careRoomConcerns(@Args('careRoomId') careRoomId: string, @Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    const membership = await this.accessService.requireFamilyScopes({
      careRoomId,
      organizationId: actor.organizationId || '',
      authSubject: actor.userId,
      email: actor.email,
      requiredScopes: [AccessGrantScope.RAISE_CONCERNS],
    });

    const concerns = await this.concernService.listConcernsForRoom(
      careRoomId,
      membership.care_room.organization_id || actor.organizationId,
    );
    return concerns.map(mapConcern);
  }
}
