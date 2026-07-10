import { Args, Context, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SetMetadata, UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../auth/gql-roles.guard';
import { CareLogService } from './care-log.service';
import { CareLogDTO, CareLogPaginatedResponse } from './dto/care-log.dto';
import { CreateCareLogInput } from './dto/create-care-log.input';
import { CareLogFilterArgs } from './dto/care-log-filter.args';
import { MonthlyCareSummaryDTO } from './dto/monthly-care-summary.dto';
import { LegacyOperationalSurface } from '../auth/legacy-operational-access';
import { requireOperationalActor } from '../carer/carer-access.service';

const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => SetMetadata('roles', roles);

@Resolver(() => CareLogDTO)
@UseGuards(GqlRolesGuard)
@LegacyOperationalSurface()
export class CareLogResolver {
  constructor(private readonly careLogService: CareLogService) {}

  @Mutation(() => CareLogDTO)
  @Roles('admin', 'carer')
  async createCareLog(@Args('input') input: CreateCareLogInput, @Context() ctx: any): Promise<CareLogDTO> {
    const { userId, userRole, organizationId } = requireOperationalActor(ctx.req.user);

    const careLog = await this.careLogService.createCareLog(input, userId, userRole, organizationId);
    return this.mapToDTO(careLog);
  }

  @Query(() => CareLogPaginatedResponse)
  @Roles('admin', 'carer')
  async careLogs(@Args() filter: CareLogFilterArgs, @Context() ctx: any): Promise<CareLogPaginatedResponse> {
    const { userId, userRole, organizationId } = requireOperationalActor(ctx.req.user);

    const result = await this.careLogService.listCareLogs(filter, userId, userRole, organizationId);
    return {
      items: result.items.map((item) => this.mapToDTO(item)),
      total: result.total,
    };
  }

  @Query(() => MonthlyCareSummaryDTO)
  @Roles('admin', 'carer')
  async monthlyCareSummary(
    @Args('clientId', { type: () => ID }) clientId: string,
    @Args('year', { type: () => Int }) year: number,
    @Args('month', { type: () => Int }) month: number,
    @Context() ctx: any,
  ): Promise<MonthlyCareSummaryDTO> {
    const { userId, userRole, organizationId } = requireOperationalActor(ctx.req.user);
    return this.careLogService.monthlyCareSummary(clientId, year, month, userId, userRole, organizationId);
  }

  private mapToDTO(log: any): CareLogDTO {
    return {
      id: log.id,
      clientId: log.client_id,
      carerId: log.carer_id,
      visitId: log.visit_id,
      medicationAdministrationId: log.medication_administration_id,
      occurredAt: log.occurred_at,
      category: log.category,
      notes: log.notes,
      urinePassed: log.urine_passed,
      bowelMovement: log.bowel_movement,
      stoolType: log.stool_type,
      continenceStatus: log.continence_status,
      assistanceLevel: log.assistance_level,
      mealType: log.meal_type,
      intakeAmount: log.intake_amount,
      fluidMl: log.fluid_ml,
      appetite: log.appetite,
      slept: log.slept,
      sleepStart: log.sleep_start,
      sleepEnd: log.sleep_end,
      sleepQuality: log.sleep_quality,
      moodLevel: log.mood_level,
      agitation: log.agitation,
      confusion: log.confusion,
      painScore: log.pain_score,
      escalated: log.escalated,
      escalatedTo: log.escalated_to,
      escalatedAt: log.escalated_at,
      source: log.source,
      createdAt: log.created_at,
      updatedAt: log.updated_at,
    };
  }
}
