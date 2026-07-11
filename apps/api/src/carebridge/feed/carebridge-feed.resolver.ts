import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../../auth/gql-roles.guard';
import { getCarebridgeActor } from '../current-user';
import { mapVerifiedVisitStory } from '../mappers';
import { CarebridgeRoles } from '../roles';
import { PublishVerifiedVisitStoryInput } from './dto/publish-verified-visit-story.input';
import { VerifiedVisitStoryDTO } from './dto/verified-visit-story.dto';
import { CarebridgeFeedService } from './carebridge-feed.service';

@Resolver(() => VerifiedVisitStoryDTO)
@UseGuards(GqlRolesGuard)
export class CarebridgeFeedResolver {
  constructor(private readonly feedService: CarebridgeFeedService) {}

  @Mutation(() => VerifiedVisitStoryDTO)
  @CarebridgeRoles('admin')
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
  @CarebridgeRoles('admin')
  async publishVerifiedVisitStory(@Args('input') input: PublishVerifiedVisitStoryInput, @Context() ctx: any) {
    const actor = getCarebridgeActor(ctx);
    const story = await this.feedService.publishVerifiedVisitStory({
      ...input,
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
    });
    return mapVerifiedVisitStory(story);
  }
}
