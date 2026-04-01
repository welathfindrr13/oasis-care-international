import { Args, ID, Mutation, Query, Resolver, Context } from '@nestjs/graphql';
import { SetMetadata, UseGuards } from '@nestjs/common';
import { RolesGuard } from '@oasis/auth';
import { CarePlanAuditEntryDTO, CarePlanDTO, CarePlanVersionDTO } from './dto/care-plan.dto';
import { SaveCarePlanDraftInput } from './dto/save-care-plan-draft.input';
import { CarePlanService } from './care-plan.service';

export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata('roles', roles);

@Resolver(() => CarePlanDTO)
@UseGuards(RolesGuard)
export class CarePlanResolver {
  constructor(private readonly carePlanService: CarePlanService) {}

  private getActor(ctx: any) {
    const user = ctx.req?.user ?? {};
    const roles = user.realm_access?.roles ?? user.roles ?? (user.role ? [user.role] : []);

    return {
      userId: user.sub || user.id || 'anonymous',
      userRole: roles[0] || 'client',
    };
  }

  @Query(() => CarePlanDTO, { nullable: true })
  @Roles('admin')
  async clientCarePlan(
    @Args('clientId', { type: () => ID }) clientId: string,
    @Context() ctx: any,
  ): Promise<CarePlanDTO | null> {
    const { userRole } = this.getActor(ctx);
    return this.carePlanService.getClientCarePlan(clientId, userRole);
  }

  @Query(() => [CarePlanVersionDTO])
  @Roles('admin')
  async clientCarePlanHistory(
    @Args('clientId', { type: () => ID }) clientId: string,
    @Context() ctx: any,
  ): Promise<CarePlanVersionDTO[]> {
    const { userRole } = this.getActor(ctx);
    return this.carePlanService.getClientCarePlanHistory(clientId, userRole);
  }

  @Query(() => [CarePlanAuditEntryDTO])
  @Roles('admin')
  async clientCarePlanAuditHistory(
    @Args('clientId', { type: () => ID }) clientId: string,
    @Context() ctx: any,
  ): Promise<CarePlanAuditEntryDTO[]> {
    const { userRole } = this.getActor(ctx);
    return this.carePlanService.getClientCarePlanAuditHistory(clientId, userRole);
  }

  @Mutation(() => CarePlanVersionDTO)
  @Roles('admin')
  async saveCarePlanDraft(
    @Args('input') input: SaveCarePlanDraftInput,
    @Context() ctx: any,
  ): Promise<CarePlanVersionDTO> {
    const { userId, userRole } = this.getActor(ctx);
    return this.carePlanService.saveDraft(input, userId, userRole);
  }

  @Mutation(() => CarePlanVersionDTO)
  @Roles('admin')
  async publishCarePlanDraft(
    @Args('carePlanId', { type: () => ID }) carePlanId: string,
    @Context() ctx: any,
  ): Promise<CarePlanVersionDTO> {
    const { userId, userRole } = this.getActor(ctx);
    return this.carePlanService.publishDraft(carePlanId, userId, userRole);
  }

  @Mutation(() => CarePlanDTO)
  @Roles('admin')
  async discardCarePlanDraft(
    @Args('carePlanId', { type: () => ID }) carePlanId: string,
    @Context() ctx: any,
  ): Promise<CarePlanDTO> {
    const { userId, userRole } = this.getActor(ctx);
    return this.carePlanService.discardDraft(carePlanId, userId, userRole);
  }
}
