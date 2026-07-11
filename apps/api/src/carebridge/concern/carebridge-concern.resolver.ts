import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../../auth/gql-roles.guard';
import { getCarebridgeActor } from '../current-user';
import { mapConcern } from '../mappers';
import { CarebridgeRoles } from '../roles';
import { AcknowledgeConcernInput } from './dto/acknowledge-concern.input';
import { ConcernDTO } from './dto/concern.dto';
import { ResolveConcernInput } from './dto/resolve-concern.input';
import { RespondToConcernInput } from './dto/respond-to-concern.input';
import { CarebridgeConcernService } from './carebridge-concern.service';

@Resolver(() => ConcernDTO)
@UseGuards(GqlRolesGuard)
export class CarebridgeConcernResolver {
  constructor(private readonly concernService: CarebridgeConcernService) {}

  @Mutation(() => ConcernDTO)
  @CarebridgeRoles('admin')
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
  @CarebridgeRoles('admin')
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
  @CarebridgeRoles('admin')
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
}
