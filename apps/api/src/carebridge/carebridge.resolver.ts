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
  FamilyCareRoomDTO,
  FamilyVerifiedVisitStoryDTO,
  UpdateFamilyAccessGrantsInput,
  FamilyMembershipActionInput,
  FamilyInvitationActionInput,
  FamilyConcernReceiptDTO,
} from './dto/carebridge.dto';
import { FamilyInvitationService } from './family-invitation.service';

const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => SetMetadata('roles', roles);

@Resolver()
@UseGuards(GqlRolesGuard)
export class CarebridgeResolver {
  constructor(
    private readonly carebridgeService: CarebridgeService,
    private readonly familyInvitations: FamilyInvitationService,
  ) {}

  @Query(() => [CareRoomDTO])
  @Roles('admin')
  async careRooms(@Context() ctx: any) {
    return this.carebridgeService.listCareRooms(this.viewerFromContext(ctx));
  }

  @Query(() => CareRoomDTO)
  @Roles('admin')
  async careRoom(@Args('id') id: string, @Context() ctx: any) {
    return this.carebridgeService.getCareRoom(id, this.viewerFromContext(ctx));
  }

  @Query(() => [VerifiedVisitStoryDTO])
  @Roles('admin')
  async verifiedVisitStories(@Args('careRoomId') careRoomId: string, @Context() ctx: any) {
    return this.carebridgeService.listVerifiedVisitStories(careRoomId, this.viewerFromContext(ctx));
  }

  @Query(() => [FamilyCareRoomDTO])
  @Roles('user')
  async familyCareRooms(@Context() ctx: any) {
    return this.carebridgeService.listFamilyCareRooms(this.viewerFromContext(ctx));
  }

  @Query(() => FamilyCareRoomDTO)
  @Roles('user')
  async familyCareRoom(@Args('id') id: string, @Context() ctx: any) {
    return this.carebridgeService.getFamilyCareRoom(id, this.viewerFromContext(ctx));
  }

  @Query(() => [FamilyVerifiedVisitStoryDTO])
  @Roles('user')
  async familyVerifiedVisitStories(
    @Args('careRoomId') careRoomId: string,
    @Context() ctx: any,
  ) {
    return this.carebridgeService.listFamilyVerifiedVisitStories(
      careRoomId,
      this.viewerFromContext(ctx),
    );
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
    return this.familyInvitations.invite(input, this.adminPrincipal(ctx));
  }

  @Mutation(() => CareRoomMembershipDTO)
  @Roles('admin')
  async updateFamilyAccessGrants(
    @Args('input') input: UpdateFamilyAccessGrantsInput,
    @Context() ctx: any,
  ) {
    return this.familyInvitations.setGrants(input, this.adminPrincipal(ctx));
  }

  @Mutation(() => CareRoomMembershipDTO)
  @Roles('admin')
  async revokeFamilyAccess(
    @Args('input') input: FamilyMembershipActionInput,
    @Context() ctx: any,
  ) {
    return this.familyInvitations.revokeAccess(
      input.careRoomMembershipId,
      this.adminPrincipal(ctx),
    );
  }

  @Mutation(() => CareRoomMembershipDTO)
  @Roles('admin')
  async revokeFamilyInvitation(
    @Args('input') input: FamilyInvitationActionInput,
    @Context() ctx: any,
  ) {
    return this.familyInvitations.revokeInvitation(
      input.invitationId,
      this.adminPrincipal(ctx),
    );
  }

  @Mutation(() => CareRoomMembershipDTO)
  @Roles('admin')
  async retryFamilyInvitationDelivery(
    @Args('input') input: FamilyInvitationActionInput,
    @Context() ctx: any,
  ) {
    return this.familyInvitations.retryDelivery(
      input.invitationId,
      this.adminPrincipal(ctx),
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
  @Roles('admin')
  async raiseCarebridgeConcern(@Args('input') input: RaiseConcernInput, @Context() ctx: any) {
    return this.carebridgeService.raiseConcern(input, this.viewerFromContext(ctx));
  }

  @Mutation(() => FamilyConcernReceiptDTO)
  @Roles('user')
  async raiseFamilyCarebridgeConcern(
    @Args('input') input: RaiseConcernInput,
    @Context() ctx: any,
  ) {
    return this.carebridgeService.raiseFamilyConcern(
      input,
      this.viewerFromContext(ctx),
    );
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

  private adminPrincipal(ctx: any) {
    const user = ctx?.req?.user ?? {};
    return {
      organizationId: user.organizationId || null,
      organizationMembershipId: user.organizationMembershipId || null,
      authSubject: user.accessContext?.authSubject || user.sub || user.id || null,
    };
  }
}
