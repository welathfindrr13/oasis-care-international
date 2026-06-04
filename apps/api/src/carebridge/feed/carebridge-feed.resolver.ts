import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../../auth/gql-roles.guard';
import { CarebridgeAccessService } from '../access/carebridge-access.service';
import { getCarebridgeActor } from '../current-user';
import { AccessGrantScope } from '../dto/carebridge.enums';
import { mapVerifiedVisitStory } from '../mappers';
import { CarebridgeRoles } from '../roles';
import { PublishVerifiedVisitStoryInput } from './dto/publish-verified-visit-story.input';
import { VerifiedVisitStoryDTO } from './dto/verified-visit-story.dto';
import { CarebridgeFeedService } from './carebridge-feed.service';

@Resolver(() => VerifiedVisitStoryDTO)
@UseGuards(GqlRolesGuard)
export class CarebridgeFeedResolver {
  constructor(
    private readonly feedService: CarebridgeFeedService,
    private readonly accessService: CarebridgeAccessService,
  ) {}

  @Mutation(() => VerifiedVisitStoryDTO)
  @CarebridgeRoles('admin', 'carer')
  async syncVerifiedVisitStory(@Args('visitId') visitId: string, @Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    const story = await this.feedService.syncVerifiedVisitStory({
      visitId,
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
    });
    return mapVerifiedVisitStory(story);
  }

  @Mutation(() => VerifiedVisitStoryDTO)
  @CarebridgeRoles('admin', 'carer')
  async publishVerifiedVisitStory(@Args('input') input: PublishVerifiedVisitStoryInput, @Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    const story = await this.feedService.publishVerifiedVisitStory({
      ...input,
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
    });
    return mapVerifiedVisitStory(story);
  }

  @Query(() => [VerifiedVisitStoryDTO])
  @CarebridgeRoles('user')
  async careRoomFeed(@Args('careRoomId') careRoomId: string, @Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    await this.accessService.requireFamilyScope({
      careRoomId,
      organizationId: actor.organizationId,
      authSubject: actor.userId,
      email: actor.email,
      requiredScope: AccessGrantScope.VIEW_UPDATES,
    });
    const stories = await this.feedService.listPublishedStoriesForRoom(careRoomId);
    return stories.map(mapVerifiedVisitStory);
  }
}
