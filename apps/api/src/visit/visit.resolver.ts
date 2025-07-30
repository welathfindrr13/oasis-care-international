import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { VisitService } from './visit.service';
import { VisitDTO, VisitPaginatedResponse, VisitTaskDTO } from './dto/visit.dto';
import { CreateVisitInput } from './dto/create-visit.input';
import { UpdateVisitInput } from './dto/update-visit.input';
import { VisitFilterArgs } from './dto/visit-filter.args';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@oasis/auth';

export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => 
  SetMetadata('roles', roles);

@Resolver(() => VisitDTO)
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class VisitResolver {
  constructor(private readonly visitService: VisitService) {}

  @Query(() => VisitDTO)
  @Roles('admin', 'carer', 'client')
  async visit(
    @Args('id') id: string,
    @Context() ctx: any
  ): Promise<VisitDTO> {
    const { sub: userId, realm_access } = ctx.req.user;
    const userRole = realm_access?.roles?.[0] || 'client';

    const visit = await this.visitService.findVisitById(id, userId, userRole);
    return this.mapVisitToDTO(visit);
  }

  @Query(() => VisitPaginatedResponse)
  @Roles('admin', 'carer', 'client')
  async visits(
    @Args() filter: VisitFilterArgs,
    @Context() ctx: any
  ): Promise<VisitPaginatedResponse> {
    const { sub: userId, realm_access } = ctx.req.user;
    const userRole = realm_access?.roles?.[0] || 'client';

    const result = await this.visitService.findVisits(filter, userId, userRole);
    
    return {
      items: result.items.map(v => this.mapVisitToDTO(v)),
      total: result.total,
    };
  }

  @Mutation(() => VisitDTO)
  @Roles('admin', 'carer')
  async createVisit(
    @Args('input') input: CreateVisitInput,
    @Context() ctx: any
  ): Promise<VisitDTO> {
    const { sub: userId, realm_access } = ctx.req.user;
    const userRole = realm_access?.roles?.[0] || 'carer';

    const visit = await this.visitService.createVisit(input, userId, userRole);
    return this.mapVisitToDTO(visit);
  }

  @Mutation(() => VisitDTO)
  @Roles('admin', 'carer')
  async updateVisit(
    @Args('input') input: UpdateVisitInput,
    @Context() ctx: any
  ): Promise<VisitDTO> {
    const { sub: userId, realm_access } = ctx.req.user;
    const userRole = realm_access?.roles?.[0] || 'carer';

    const visit = await this.visitService.updateVisit(
      input.id,
      input,
      userId,
      userRole
    );
    return this.mapVisitToDTO(visit);
  }

  @Mutation(() => VisitDTO)
  @Roles('admin')
  async deleteVisit(
    @Args('id') id: string,
    @Context() ctx: any
  ): Promise<VisitDTO> {
    const { sub: userId, realm_access } = ctx.req.user;
    const userRole = realm_access?.roles?.[0] || 'admin';

    const visit = await this.visitService.deleteVisit(id, userId, userRole);
    return this.mapVisitToDTO(visit);
  }

  @Mutation(() => VisitTaskDTO)
  @Roles('admin', 'carer')
  async completeVisitTask(
    @Args('taskId') taskId: string,
    @Args('notes', { nullable: true, type: () => String }) notes: string | undefined,
    @Context() ctx: any
  ): Promise<VisitTaskDTO> {
    const { sub: userId, realm_access } = ctx.req.user;
    const userRole = realm_access?.roles?.[0] || 'carer';

    const task = await this.visitService.completeTask(
      taskId,
      notes,
      userId,
      userRole
    );

    return {
      id: task.id,
      taskName: task.task_name,
      description: task.description,
      isCompleted: task.is_completed,
      completedAt: task.completed_at,
      notes: task.notes,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    };
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
      carer: visit.carer ? {
        id: visit.carer.id,
        firstName: visit.carer.first_name,
        lastName: visit.carer.last_name,
        email: visit.carer.email,
        phone: visit.carer.phone,
      } : null,
      client: visit.client ? {
        id: visit.client.id,
        fullName: visit.client.full_name,
        addressLine1: visit.client.address_line1,
        addressLine2: visit.client.address_line2,
        city: visit.client.city,
        postcode: visit.client.postcode,
      } : null,
      tasks: visit.tasks?.map((task: any) => ({
        id: task.id,
        taskName: task.task_name,
        description: task.description,
        isCompleted: task.is_completed,
        completedAt: task.completed_at,
        notes: task.notes,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      })) || [],
      createdAt: visit.created_at,
      updatedAt: visit.updated_at,
    };
  }
}
