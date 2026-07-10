import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SetMetadata, UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../auth/gql-roles.guard';
import { CarebridgeService } from './carebridge.service';
import {
  CareRoomDTO,
  CareRoomMembershipDTO,
  CreateCareRoomInput,
  InviteFamilyContactInput,
  RaiseConcernInput,
  RejectVerifiedVisitStoryInput,
  SubmitFamilyPulseInput,
  UpdateCarebridgePolicyInput,
  UpdateConcernStatusInput,
  VerifiedVisitStoryDTO,
  ConcernDTO,
  FamilyPulseDTO,
  CareBridgePolicyDTO,
} from './dto/carebridge.dto';

const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => SetMetadata('roles', roles);

@Resolver()
@UseGuards(GqlRolesGuard)
export class CarebridgeResolver {
  constructor(private readonly carebridgeService: CarebridgeService) {}

  @Query(() => [CareRoomDTO])
  @Roles('admin', 'user')
  async careRooms(@Context() ctx: any) {
    return this.carebridgeService.listCareRooms(this.viewerFromContext(ctx));
  }

  @Query(() => CareRoomDTO)
  @Roles('admin', 'user')
  async careRoom(@Args('id') id: string, @Context() ctx: any) {
    return this.carebridgeService.getCareRoom(id, this.viewerFromContext(ctx));
  }

  @Query(() => [VerifiedVisitStoryDTO])
  @Roles('admin', 'user')
  async verifiedVisitStories(@Args('careRoomId') careRoomId: string, @Context() ctx: any) {
    return this.carebridgeService.listVerifiedVisitStories(careRoomId, this.viewerFromContext(ctx));
  }

  @Query(() => [ConcernDTO])
  @Roles('admin')
  async carebridgeConcernInbox(
    @Args('status', { type: () => String, nullable: true })
    status: string | undefined,
    @Context() ctx: any,
  ) {
    return this.carebridgeService.listConcernInbox(this.viewerFromContext(ctx), status as any);
  }

  @Query(() => [VerifiedVisitStoryDTO])
  @Roles('admin')
  async verifiedVisitStoryApprovalQueue(
    @Context() ctx: any,
    @Args('careRoomId', { nullable: true }) careRoomId?: string,
  ) {
    return this.carebridgeService.listVerifiedVisitStoryApprovalQueue(this.viewerFromContext(ctx), careRoomId);
  }

  @Mutation(() => CareRoomDTO)
  @Roles('admin')
  async createCareRoom(@Args('input') input: CreateCareRoomInput, @Context() ctx: any) {
    const viewer = this.viewerFromContext(ctx);
    return this.carebridgeService.createCareRoom(
      input.clientId,
      viewer.userId || 'unknown',
      viewer.role,
      viewer.organizationId || '',
    );
  }

  @Mutation(() => CareRoomMembershipDTO)
  @Roles('admin')
  async inviteFamilyContact(@Args('input') input: InviteFamilyContactInput, @Context() ctx: any) {
    const viewer = this.viewerFromContext(ctx);
    return this.carebridgeService.inviteFamilyContact(
      input,
      viewer.userId || 'unknown',
      viewer.role,
      viewer.organizationId || '',
    );
  }

  @Mutation(() => CareBridgePolicyDTO)
  @Roles('admin')
  async updateCarebridgePolicy(@Args('input') input: UpdateCarebridgePolicyInput, @Context() ctx: any) {
    const viewer = this.viewerFromContext(ctx);
    return this.carebridgeService.updatePolicy(
      input,
      viewer.userId || 'unknown',
      viewer.role,
      viewer.organizationId || '',
    );
  }

  @Mutation(() => VerifiedVisitStoryDTO)
  @Roles('admin')
  async generateVerifiedVisitStory(@Args('visitId') visitId: string, @Context() ctx: any) {
    const viewer = this.viewerFromContext(ctx);
    return this.carebridgeService.generateVerifiedVisitStory(
      visitId,
      viewer.userId || 'unknown',
      viewer.organizationId || '',
    );
  }

  @Mutation(() => VerifiedVisitStoryDTO)
  @Roles('admin')
  async publishVerifiedVisitStory(@Args('storyId') storyId: string, @Context() ctx: any) {
    const viewer = this.viewerFromContext(ctx);
    return this.carebridgeService.publishVerifiedVisitStory(storyId, viewer.userId || '', viewer.organizationId || '');
  }

  @Mutation(() => VerifiedVisitStoryDTO)
  @Roles('admin')
  async rejectVerifiedVisitStory(@Args('input') input: RejectVerifiedVisitStoryInput, @Context() ctx: any) {
    const viewer = this.viewerFromContext(ctx);
    return this.carebridgeService.rejectVerifiedVisitStory(
      input.storyId,
      input.rejectionReason,
      viewer.userId || '',
      viewer.organizationId || '',
    );
  }

  @Mutation(() => ConcernDTO)
  @Roles('admin', 'user')
  async raiseCarebridgeConcern(@Args('input') input: RaiseConcernInput, @Context() ctx: any) {
    return this.carebridgeService.raiseConcern(input, this.viewerFromContext(ctx));
  }

  @Mutation(() => ConcernDTO)
  @Roles('admin')
  async updateCarebridgeConcern(@Args('input') input: UpdateConcernStatusInput, @Context() ctx: any) {
    const viewer = this.viewerFromContext(ctx);
    return this.carebridgeService.updateConcernStatus(
      input,
      viewer.userId || 'unknown',
      viewer.role,
      viewer.organizationId || '',
    );
  }

  @Mutation(() => FamilyPulseDTO)
  @Roles('user')
  async submitFamilyPulse(@Args('input') input: SubmitFamilyPulseInput, @Context() ctx: any) {
    return this.carebridgeService.submitFamilyPulse(input, this.viewerFromContext(ctx));
  }

  private viewerFromContext(ctx: any) {
    const user = ctx?.req?.user ?? {};
    const rawRoles = user?.realm_access?.roles ?? user?.roles ?? [];
    const role = Array.isArray(rawRoles) && rawRoles.length > 0 ? rawRoles[0] : 'user';
    return {
      role,
      userId: user.sub || user.id,
      organizationId: user.organizationId || null,
      email: user.email || null,
      authSubject: user.sub || user.id || null,
    };
  }
}
