import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SetMetadata, UseGuards } from '@nestjs/common';
import { GqlRolesGuard } from '../auth/gql-roles.guard';
import { LegacyOperationalSurface } from '../auth/legacy-operational-access';
import { CarePlanningService } from './care-planning.service';
import { AssessmentDTO, CarePlanDTO, EvidencePackDTO, EvidenceSourceCandidateDTO } from './dto/care-planning.dto';
import { CreateAssessmentInput } from './dto/create-assessment.input';
import { CreateCarePlanInput } from './dto/create-care-plan.input';
import { CreateEvidencePackInput } from './dto/create-evidence-pack.input';
import { CompleteAssessmentInput } from './dto/complete-assessment.input';
import { ApproveCarePlanInput } from './dto/approve-care-plan.input';
import { ArchiveCarePlanInput } from './dto/archive-care-plan.input';
import { EvidenceSourceCandidatesInput } from './dto/evidence-source-candidates.input';

const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => SetMetadata('roles', roles);

@Resolver()
@UseGuards(GqlRolesGuard)
@LegacyOperationalSurface()
export class CarePlanningResolver {
  constructor(private readonly carePlanningService: CarePlanningService) {}

  @Query(() => [AssessmentDTO])
  @Roles('admin')
  async assessments(
    @Args('clientId') clientId: string,
    @Args('take', { type: () => Int, nullable: true, defaultValue: 20 })
    take: number,
    @Context() ctx: any,
  ): Promise<AssessmentDTO[]> {
    return this.carePlanningService.listAssessments(clientId, take, this.viewerFromContext(ctx));
  }

  @Mutation(() => AssessmentDTO)
  @Roles('admin')
  async createAssessment(@Args('input') input: CreateAssessmentInput, @Context() ctx: any): Promise<AssessmentDTO> {
    return this.carePlanningService.createAssessment(input, this.viewerFromContext(ctx));
  }

  @Query(() => AssessmentDTO)
  @Roles('admin')
  async getAssessment(@Args('id') id: string, @Context() ctx: any): Promise<AssessmentDTO> {
    return this.carePlanningService.getAssessment(id, this.viewerFromContext(ctx));
  }

  @Mutation(() => AssessmentDTO)
  @Roles('admin')
  async completeAssessment(@Args('input') input: CompleteAssessmentInput, @Context() ctx: any): Promise<AssessmentDTO> {
    return this.carePlanningService.completeAssessment(input, this.viewerFromContext(ctx));
  }

  @Query(() => [CarePlanDTO])
  @Roles('admin')
  async carePlans(
    @Args('clientId') clientId: string,
    @Args('take', { type: () => Int, nullable: true, defaultValue: 20 })
    take: number,
    @Context() ctx: any,
  ): Promise<CarePlanDTO[]> {
    return this.carePlanningService.listCarePlans(clientId, take, this.viewerFromContext(ctx));
  }

  @Mutation(() => CarePlanDTO)
  @Roles('admin')
  async createCarePlan(@Args('input') input: CreateCarePlanInput, @Context() ctx: any): Promise<CarePlanDTO> {
    return this.carePlanningService.createCarePlan(input, this.viewerFromContext(ctx));
  }

  @Query(() => CarePlanDTO)
  @Roles('admin')
  async getCarePlan(@Args('id') id: string, @Context() ctx: any): Promise<CarePlanDTO> {
    return this.carePlanningService.getCarePlan(id, this.viewerFromContext(ctx));
  }

  @Mutation(() => CarePlanDTO)
  @Roles('admin')
  async approveCarePlan(@Args('input') input: ApproveCarePlanInput, @Context() ctx: any): Promise<CarePlanDTO> {
    return this.carePlanningService.approveCarePlan(input, this.viewerFromContext(ctx));
  }

  @Mutation(() => CarePlanDTO)
  @Roles('admin')
  async archiveCarePlan(@Args('input') input: ArchiveCarePlanInput, @Context() ctx: any): Promise<CarePlanDTO> {
    return this.carePlanningService.archiveCarePlan(input, this.viewerFromContext(ctx));
  }

  @Query(() => [EvidencePackDTO])
  @Roles('admin')
  async evidencePacks(
    @Args('clientId') clientId: string,
    @Args('take', { type: () => Int, nullable: true, defaultValue: 20 })
    take: number,
    @Context() ctx: any,
  ): Promise<EvidencePackDTO[]> {
    return this.carePlanningService.listEvidencePacks(clientId, take, this.viewerFromContext(ctx));
  }

  @Query(() => [EvidenceSourceCandidateDTO])
  @Roles('admin')
  async evidenceSourceCandidates(
    @Args('input') input: EvidenceSourceCandidatesInput,
    @Context() ctx: any,
  ): Promise<EvidenceSourceCandidateDTO[]> {
    return this.carePlanningService.evidenceSourceCandidates(input, this.viewerFromContext(ctx));
  }

  @Mutation(() => EvidencePackDTO)
  @Roles('admin')
  async createEvidencePack(
    @Args('input') input: CreateEvidencePackInput,
    @Context() ctx: any,
  ): Promise<EvidencePackDTO> {
    return this.carePlanningService.createEvidencePack(input, this.viewerFromContext(ctx));
  }

  @Query(() => EvidencePackDTO)
  @Roles('admin')
  async getEvidencePack(@Args('id') id: string, @Context() ctx: any): Promise<EvidencePackDTO> {
    return this.carePlanningService.getEvidencePack(id, this.viewerFromContext(ctx));
  }

  @Mutation(() => EvidencePackDTO)
  @Roles('admin')
  async recordEvidencePackExport(@Args('id') id: string, @Context() ctx: any): Promise<EvidencePackDTO> {
    return this.carePlanningService.recordEvidencePackExport(id, this.viewerFromContext(ctx));
  }

  private viewerFromContext(ctx: any): {
    role: string;
    organizationId?: string | null;
    userId?: string | null;
  } {
    const user = ctx?.req?.user ?? {};
    const rawRoles = user?.realm_access?.roles ?? user?.roles ?? [];
    const role = Array.isArray(rawRoles) && rawRoles.length > 0 ? rawRoles[0] : 'user';
    return {
      role,
      organizationId: user.organizationId || null,
      userId: user.sub || user.id || user.userId || null,
    };
  }
}
