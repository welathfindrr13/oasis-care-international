import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../../auth/gql-roles.guard';
import { CarebridgeRoles } from '../roles';
import { getCarebridgeActor } from '../current-user';
import { CareRoomService } from './care-room.service';
import { CareBridgePolicyDTO, CareRoomDTO } from './dto/care-room.dto';
import { CreateCareRoomInput } from './dto/create-care-room.input';
import { UpsertCarebridgePolicyInput } from './dto/upsert-carebridge-policy.input';
import { mapCareBridgePolicy, mapCareRoom } from '../mappers';

@Resolver(() => CareRoomDTO)
@UseGuards(GqlRolesGuard)
export class CareRoomResolver {
  constructor(private readonly careRoomService: CareRoomService) {}

  @Mutation(() => CareRoomDTO)
  @CarebridgeRoles('admin')
  async createCareRoom(@Args('input') input: CreateCareRoomInput, @Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    const room = await this.careRoomService.createCareRoom(input, actor.userId, actor.organizationId);
    return mapCareRoom(room);
  }

  @Mutation(() => CareBridgePolicyDTO)
  @CarebridgeRoles('admin')
  async upsertCareBridgePolicy(@Args('input') input: UpsertCarebridgePolicyInput, @Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    const policy = await this.careRoomService.upsertPolicy(input, actor.userId, actor.organizationId);
    return mapCareBridgePolicy(policy);
  }
}
