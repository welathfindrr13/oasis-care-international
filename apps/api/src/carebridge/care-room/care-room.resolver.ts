import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../../auth/gql-roles.guard';
import { CarebridgeRoles } from '../roles';
import { getCarebridgeActor } from '../current-user';
import { CareRoomService } from './care-room.service';
import { CareBridgePolicyDTO, CareRoomDTO, CareRoomMembershipDTO } from './dto/care-room.dto';
import { CreateCareRoomInput } from './dto/create-care-room.input';
import { GrantCareRoomAccessInput } from './dto/grant-care-room-access.input';
import { UpsertCarebridgePolicyInput } from './dto/upsert-carebridge-policy.input';
import { mapCareBridgePolicy, mapCareRoom, mapCareRoomMembership } from '../mappers';

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

  @Mutation(() => CareRoomMembershipDTO)
  @CarebridgeRoles('admin')
  async grantCareRoomAccess(@Args('input') input: GrantCareRoomAccessInput, @Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    const membership = await this.careRoomService.grantFamilyAccess(input, actor.userId, actor.organizationId);
    return mapCareRoomMembership(membership);
  }

  @Mutation(() => CareBridgePolicyDTO)
  @CarebridgeRoles('admin')
  async upsertCareBridgePolicy(@Args('input') input: UpsertCarebridgePolicyInput, @Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    const policy = await this.careRoomService.upsertPolicy(input, actor.userId, actor.organizationId);
    return mapCareBridgePolicy(policy);
  }

  @Query(() => [CareRoomDTO])
  @CarebridgeRoles('user')
  async myCareRooms(@Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    const rooms = await this.careRoomService.listMyCareRooms(actor.userId, actor.email);
    return rooms.map(mapCareRoom);
  }
}
