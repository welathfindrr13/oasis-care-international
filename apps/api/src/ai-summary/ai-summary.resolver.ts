import { Resolver, Query, Mutation, Args, Context, ID, Int } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AiSummaryService } from './ai-summary.service';
import { 
  HealthSummaryDTO, 
  HealthSummaryPaginatedResponse 
} from './dto/health-summary.dto';
import { GenerateSummaryInput } from './dto/generate-summary.input';
import { ApproveSummaryInput } from './dto/approve-summary.input';
import { HealthSummaryFilterArgs } from './dto/health-summary-filter.args';
import { RolesGuard, primaryRole } from '@oasis/auth';

export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => 
  SetMetadata('roles', roles);

@Resolver(() => HealthSummaryDTO)
@UseGuards(RolesGuard)
export class AiSummaryResolver {
  constructor(private readonly aiSummaryService: AiSummaryService) {}

  @Query(() => HealthSummaryPaginatedResponse)
  @Roles('admin')
  async listPendingSummaries(
    @Args('skip', { type: () => Int, nullable: true }) skip: number = 0,
    @Args('take', { type: () => Int, nullable: true }) take: number = 20,
    @Context() ctx: any
  ): Promise<HealthSummaryPaginatedResponse> {
    const { sub: userId } = ctx.req.user;
    const userRole = primaryRole(ctx.req.user) || 'carer';

    const result = await this.aiSummaryService.listPendingSummaries(
      skip, 
      take, 
      userId, 
      userRole
    );
    
    return {
      items: result.items.map(s => this.mapHealthSummaryToDTO(s)),
      total: result.total,
    };
  }

  @Query(() => HealthSummaryPaginatedResponse)
  @Roles('admin', 'manager', 'carer', 'client')
  async listHistory(
    @Args() filter: HealthSummaryFilterArgs,
    @Context() ctx: any
  ): Promise<HealthSummaryPaginatedResponse> {
    const { sub: userId } = ctx.req.user;
    const userRole = primaryRole(ctx.req.user) || 'client';

    const result = await this.aiSummaryService.listHistory(filter, userId, userRole);
    
    return {
      items: result.items.map(s => this.mapHealthSummaryToDTO(s)),
      total: result.total,
    };
  }

  @Query(() => HealthSummaryDTO, { nullable: true })
  @Roles('admin', 'manager', 'carer', 'client')
  async currentWeekSummary(
    @Args('clientId', { type: () => ID }) clientId: string,
    @Context() ctx: any
  ): Promise<HealthSummaryDTO | null> {
    const { sub: userId } = ctx.req.user;
    const userRole = primaryRole(ctx.req.user) || 'client';

    const summary = await this.aiSummaryService.getCurrentWeekSummary(
      clientId, 
      userId, 
      userRole
    );

    return summary ? this.mapHealthSummaryToDTO(summary) : null;
  }

  @Mutation(() => HealthSummaryDTO)
  @Roles('admin', 'manager', 'carer')
  async generateSummary(
    @Args('input') input: GenerateSummaryInput,
    @Context() ctx: any
  ): Promise<HealthSummaryDTO> {
    const { sub: userId } = ctx.req.user;
    const userRole = primaryRole(ctx.req.user) || 'carer';

    const summary = await this.aiSummaryService.generateSummary(
      input, 
      userId, 
      userRole
    );
    
    return this.mapHealthSummaryToDTO(summary);
  }

  @Mutation(() => HealthSummaryDTO)
  @Roles('admin')
  async approveSummary(
    @Args('input') input: ApproveSummaryInput,
    @Context() ctx: any
  ): Promise<HealthSummaryDTO> {
    const { sub: userId } = ctx.req.user;
    const userRole = primaryRole(ctx.req.user) || 'carer';

    const summary = await this.aiSummaryService.approveSummary(
      input, 
      userId, 
      userRole
    );
    
    return this.mapHealthSummaryToDTO(summary);
  }

  private mapHealthSummaryToDTO(summary: any): HealthSummaryDTO {
    const dto = {
      id: summary.id,
      clientId: summary.client_id,
      periodStart: summary.period_start,
      periodEnd: summary.period_end,
      summaryJson: summary.summary_json,
      riskLevels: summary.risk_levels,
      generatedAt: summary.generated_at,
      generatedBy: summary.generated_by,
      approvedBy: summary.approved_by,
      approvedAt: summary.approved_at,
      feedback: summary.feedback,
      expiresAt: summary.expires_at,
      client: summary.client ? {
        id: summary.client.id,
        fullName: summary.client.full_name,
        addressLine1: summary.client.address_line1,
        addressLine2: summary.client.address_line2,
        city: summary.client.city,
        postcode: summary.client.postcode,
      } : null,
      approver: summary.approver ? {
        id: summary.approver.id,
        firstName: summary.approver.first_name,
        lastName: summary.approver.last_name,
        email: summary.approver.email,
        phone: summary.approver.phone,
      } : null,
      createdAt: summary.created_at,
      updatedAt: summary.updated_at,
    } as HealthSummaryDTO;

    return dto;
  }
}
