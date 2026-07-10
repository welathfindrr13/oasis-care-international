import { Context, Query, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AccessContextService } from "./access-context.service";
import { ViewerAccessSnapshotDto } from "./access-context.dto";
import { GqlJwtAuthGuard } from "./gql-jwt-auth.guard";

@Resolver()
export class AccessContextResolver {
  constructor(private readonly accessContextService: AccessContextService) {}

  @Query(() => ViewerAccessSnapshotDto)
  @UseGuards(GqlJwtAuthGuard)
  async viewerAccessSnapshot(
    @Context("req") req: any,
  ): Promise<ViewerAccessSnapshotDto> {
    const context = await this.accessContextService.resolveForRequest(req);
    return ViewerAccessSnapshotDto.from(context);
  }
}
