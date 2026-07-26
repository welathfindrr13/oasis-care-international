import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { VisitService } from './visit.service';
import { VisitDTO, VisitPaginatedResponse, VisitTaskDTO } from './dto/visit.dto';
import { CreateVisitInput } from './dto/create-visit.input';
import { UpdateVisitInput } from './dto/update-visit.input';
import { VisitFilterArgs } from './dto/visit-filter.args';
import { RecordVisitTaskOutcomeInput } from './dto/record-visit-task-outcome.input';
import { SubmitVisitCareNoteInput } from './dto/submit-visit-care-note.input';
import { CompleteVisitInput } from './dto/complete-visit.input';
import { GqlRolesGuard } from '../auth/gql-roles.guard';
import { LegacyOperationalSurface } from '../auth/legacy-operational-access';
import { CareLogDTO } from '../care-log/dto/care-log.dto';
import { requireOperationalActor } from '../carer/carer-access.service';
import { RequireCapabilities } from '../auth/access-capability';
import { ManualAudit } from '../common/decorators/manual-audit.decorator';
import { VISIT_TASK_OUTCOME_PREFIX } from './visit.constants';

export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => SetMetadata('roles', roles);

@Resolver(() => VisitDTO)
@UseGuards(GqlRolesGuard)
@LegacyOperationalSurface()
export class VisitResolver {
  constructor(private readonly visitService: VisitService) {}

  @Query(() => VisitDTO)
  @Roles('admin', 'carer')
  async visit(@Args('id') id: string, @Context() ctx: any): Promise<VisitDTO> {
    const { userId, userRole, organizationId } = requireOperationalActor(ctx.req.user);

    const visit = await this.visitService.findVisitById(id, userId, userRole, organizationId);
    return this.mapVisitToDTO(visit);
  }

  @Query(() => VisitPaginatedResponse)
  @Roles('admin', 'carer')
  async visits(@Args() filter: VisitFilterArgs, @Context() ctx: any): Promise<VisitPaginatedResponse> {
    const { userId, userRole, organizationId } = requireOperationalActor(ctx.req.user);

    const result = await this.visitService.findVisits(filter, userId, userRole, organizationId);

    return {
      items: result.items.map((v) => this.mapVisitToDTO(v)),
      total: result.total,
    };
  }

  @Mutation(() => VisitDTO)
  @Roles('admin')
  async createVisit(@Args('input') input: CreateVisitInput, @Context() ctx: any): Promise<VisitDTO> {
    const { userId, userRole, organizationId } = requireOperationalActor(ctx.req.user);

    const visit = await this.visitService.createVisit(input, userId, userRole, organizationId);
    return this.mapVisitToDTO(visit);
  }

  @Mutation(() => VisitDTO)
  @Roles('admin')
  async updateVisit(@Args('input') input: UpdateVisitInput, @Context() ctx: any): Promise<VisitDTO> {
    const { userId, userRole, organizationId } = requireOperationalActor(ctx.req.user);

    const visit = await this.visitService.updateVisit(input.id, input, userId, userRole, organizationId);
    return this.mapVisitToDTO(visit);
  }

  @Mutation(() => VisitDTO)
  @Roles('admin')
  async deleteVisit(@Args('id') id: string, @Context() ctx: any): Promise<VisitDTO> {
    const { userId, userRole, organizationId } = requireOperationalActor(ctx.req.user);

    const visit = await this.visitService.deleteVisit(id, userId, userRole, organizationId);
    return this.mapVisitToDTO(visit);
  }

  @Mutation(() => VisitTaskDTO)
  @RequireCapabilities('FRONTLINE_VISIT_EXECUTE')
  async completeVisitTask(
    @Args('taskId') taskId: string,
    @Args('notes', { nullable: true, type: () => String })
    notes: string | undefined,
    @Context() ctx: any,
  ): Promise<VisitTaskDTO> {
    const { userId, userRole, organizationId, accessContext } = requireOperationalActor(ctx.req.user);

    const task = await this.visitService.completeTask(taskId, notes, userId, userRole, organizationId, accessContext);

    return this.mapVisitTaskToDTO(task);
  }

  @Mutation(() => VisitDTO)
  @RequireCapabilities('FRONTLINE_VISIT_EXECUTE')
  async startVisit(@Args('visitId') visitId: string, @Context() ctx: any): Promise<VisitDTO> {
    const { userId, userRole, organizationId, accessContext } = requireOperationalActor(ctx.req.user);

    const visit = await this.visitService.startVisit(visitId, userId, userRole, organizationId, accessContext);
    return this.mapVisitToDTO(visit);
  }

  @Mutation(() => VisitTaskDTO)
  @RequireCapabilities('FRONTLINE_VISIT_EXECUTE')
  async recordVisitTaskOutcome(
    @Args('input') input: RecordVisitTaskOutcomeInput,
    @Context() ctx: any,
  ): Promise<VisitTaskDTO> {
    const { userId, userRole, organizationId, accessContext } = requireOperationalActor(ctx.req.user);

    const task = await this.visitService.recordVisitTaskOutcome(input, userId, userRole, organizationId, accessContext);
    return this.mapVisitTaskToDTO(task);
  }

  @Mutation(() => CareLogDTO)
  @RequireCapabilities('FRONTLINE_VISIT_EXECUTE')
  async submitVisitCareNote(@Args('input') input: SubmitVisitCareNoteInput, @Context() ctx: any): Promise<CareLogDTO> {
    const { userId, userRole, organizationId, accessContext } = requireOperationalActor(ctx.req.user);

    const careLog = await this.visitService.submitVisitCareNote(input, userId, userRole, organizationId, accessContext);
    return this.mapCareLogToDTO(careLog);
  }

  @Mutation(() => VisitDTO)
  @RequireCapabilities('FRONTLINE_VISIT_EXECUTE')
  @ManualAudit()
  async completeVisit(@Args('input') input: CompleteVisitInput, @Context() ctx: any): Promise<VisitDTO> {
    const { userId, userRole, organizationId, accessContext } = requireOperationalActor(ctx.req.user);

    const visit = await this.visitService.completeVisit(input, userId, userRole, organizationId, accessContext);
    return this.mapVisitToDTO(visit);
  }

  private mapVisitToDTO(visit: any): VisitDTO {
    return {
      id: visit.id,
      carerId: visit.carer_id,
      clientId: visit.client_id,
      scheduledStart: visit.scheduled_start,
      scheduledEnd: visit.scheduled_end,
      actualStart: visit.actual_start,
      actualEnd: visit.actual_end,
      status: visit.status,
      notes: visit.notes,
      carer: visit.carer
        ? {
            id: visit.carer.id,
            firstName: visit.carer.first_name,
            lastName: visit.carer.last_name,
            email: visit.carer.email,
            phone: visit.carer.phone,
          }
        : null,
      client: visit.client
        ? {
            id: visit.client.id,
            fullName: visit.client.full_name,
            addressLine1: visit.client.address_line1,
            addressLine2: visit.client.address_line2,
            city: visit.client.city,
            postcode: visit.client.postcode,
          }
        : null,
      tasks: visit.tasks?.map((task: any) => this.mapVisitTaskToDTO(task)) || [],
      createdAt: visit.created_at,
      updatedAt: visit.updated_at,
    };
  }

  private mapVisitTaskToDTO(task: any): VisitTaskDTO {
    return {
      id: task.id,
      taskName: task.task_name,
      description: task.description,
      isCompleted: task.is_completed,
      hasRecordedOutcome: String(task.notes || '')
        .split('\n')
        .some((line) => line.trim().startsWith(VISIT_TASK_OUTCOME_PREFIX)),
      completedAt: task.completed_at,
      notes: task.notes,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    };
  }

  private mapCareLogToDTO(log: any): CareLogDTO {
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
