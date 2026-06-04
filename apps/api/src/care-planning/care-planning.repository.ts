import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '@oasis/db';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { CreateAssessmentInput } from './dto/create-assessment.input';
import { CreateCarePlanInput } from './dto/create-care-plan.input';
import { CreateEvidencePackInput } from './dto/create-evidence-pack.input';
import { CompleteAssessmentInput } from './dto/complete-assessment.input';
import { ApproveCarePlanInput } from './dto/approve-care-plan.input';
import { ArchiveCarePlanInput } from './dto/archive-care-plan.input';
import { EvidenceSourceTypeGQL } from './dto/care-planning.dto';

interface EvidenceSourceCandidateQuery {
  clientId: string;
  periodStart: Date;
  periodEnd: Date;
  sourceTypes?: EvidenceSourceTypeGQL[];
  take?: number;
}

interface EvidenceSourceCandidateRecord {
  id: string;
  sourceType: EvidenceSourceTypeGQL;
  title: string;
  subtitle?: string | null;
  occurredAt: Date;
  createdBy?: string | null;
  status?: string | null;
  previewText?: string | null;
}

const EVIDENCE_SOURCE_CANDIDATE_TYPES = new Set<EvidenceSourceTypeGQL>([
  EvidenceSourceTypeGQL.VISIT,
  EvidenceSourceTypeGQL.CARE_LOG,
  EvidenceSourceTypeGQL.MEDICATION_ADMINISTRATION,
  EvidenceSourceTypeGQL.CONCERN,
]);

@Injectable()
export class CarePlanningRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listAssessments(organizationId: string, clientId: string, take: number): Promise<any[]> {
    return this.assessmentModel().findMany({
      where: {
        organization_id: organizationId,
        client_id: clientId,
        deleted_at: null,
      },
      orderBy: [{ completed_at: 'desc' }, { created_at: 'desc' }],
      take,
    });
  }

  async createAssessment(organizationId: string, input: CreateAssessmentInput): Promise<any> {
    await this.assertClientInOrganization(organizationId, input.clientId);
    if (input.visitId) {
      await this.assertVisitInOrganization(organizationId, input.clientId, input.visitId);
    }

    return this.assessmentModel().create({
      data: {
        organization_id: organizationId,
        client_id: input.clientId,
        visit_id: input.visitId ?? null,
        status: input.status,
        source: input.source,
        title: input.title,
        summary: input.summary ?? null,
        findings: input.findings,
        risk_flags: input.riskFlags ?? null,
        recommended_actions: input.recommendedActions ?? null,
        assessor_id: input.assessorId ?? null,
        completed_at: input.completedAt ?? null,
        review_due_at: input.reviewDueAt ?? null,
      },
    });
  }

  async getAssessment(organizationId: string, id: string): Promise<any | null> {
    return this.assessmentModel().findFirst({
      where: {
        id,
        organization_id: organizationId,
        deleted_at: null,
      },
    });
  }

  async completeAssessment(
    organizationId: string,
    input: CompleteAssessmentInput,
  ): Promise<any | null> {
    const result = await this.assessmentModel().updateMany({
      where: {
        id: input.assessmentId,
        organization_id: organizationId,
        deleted_at: null,
      },
      data: {
        status: 'COMPLETED',
        assessor_id: input.assessorId ?? undefined,
        completed_at: input.completedAt ?? new Date(),
        review_due_at: input.reviewDueAt ?? undefined,
      },
    });

    if (!result?.count) {
      return null;
    }

    return this.getAssessment(organizationId, input.assessmentId);
  }

  async listCarePlans(organizationId: string, clientId: string, take: number): Promise<any[]> {
    return this.carePlanModel().findMany({
      where: {
        organization_id: organizationId,
        client_id: clientId,
        deleted_at: null,
      },
      orderBy: [{ effective_from: 'desc' }, { created_at: 'desc' }],
      take,
    });
  }

  async createCarePlan(organizationId: string, input: CreateCarePlanInput): Promise<any> {
    await this.assertClientInOrganization(organizationId, input.clientId);
    if (input.assessmentId) {
      await this.assertAssessmentInOrganization(organizationId, input.clientId, input.assessmentId);
    }

    return this.carePlanModel().create({
      data: {
        organization_id: organizationId,
        client_id: input.clientId,
        assessment_id: input.assessmentId ?? null,
        status: input.status,
        version: input.version ?? 1,
        title: input.title,
        goals: input.goals,
        interventions: input.interventions,
        safety_notes: input.safetyNotes ?? null,
        effective_from: input.effectiveFrom ?? new Date(),
        effective_to: input.effectiveTo ?? null,
        review_due_at: input.reviewDueAt ?? null,
        authored_by_id: input.authoredById ?? null,
        approved_by_id: input.approvedById ?? null,
        approved_at: input.approvedAt ?? null,
      },
    });
  }

  async getCarePlan(organizationId: string, id: string): Promise<any | null> {
    return this.carePlanModel().findFirst({
      where: {
        id,
        organization_id: organizationId,
        deleted_at: null,
      },
    });
  }

  async approveCarePlan(
    organizationId: string,
    input: ApproveCarePlanInput,
  ): Promise<any | null> {
    const current = await this.getCarePlan(organizationId, input.carePlanId);
    if (!current) {
      return null;
    }

    return this.prisma.$transaction(async (tx) => {
      const carePlanModel = this.requireModelWithClient(tx, 'carePlan');

      await carePlanModel.updateMany({
        where: {
          organization_id: organizationId,
          client_id: current.client_id,
          status: 'ACTIVE',
          id: { not: input.carePlanId },
          deleted_at: null,
        },
        data: {
          status: 'SUPERSEDED',
        },
      });

      const result = await carePlanModel.updateMany({
        where: {
          id: input.carePlanId,
          organization_id: organizationId,
          deleted_at: null,
        },
        data: {
          status: 'ACTIVE',
          approved_by_id: input.approvedById ?? undefined,
          approved_at: input.approvedAt ?? new Date(),
          effective_from: input.effectiveFrom ?? undefined,
          review_due_at: input.reviewDueAt ?? undefined,
        },
      });

      if (!result?.count) {
        return null;
      }

      return carePlanModel.findFirst({
        where: {
          id: input.carePlanId,
          organization_id: organizationId,
          deleted_at: null,
        },
      });
    });
  }

  async archiveCarePlan(
    organizationId: string,
    input: ArchiveCarePlanInput,
  ): Promise<any | null> {
    const result = await this.carePlanModel().updateMany({
      where: {
        id: input.carePlanId,
        organization_id: organizationId,
        deleted_at: null,
      },
      data: {
        status: 'ARCHIVED',
        effective_to: input.effectiveTo ?? new Date(),
      },
    });

    if (!result?.count) {
      return null;
    }

    return this.getCarePlan(organizationId, input.carePlanId);
  }

  async listEvidencePacks(organizationId: string, clientId: string, take: number): Promise<any[]> {
    return this.evidencePackModel().findMany({
      where: {
        organization_id: organizationId,
        client_id: clientId,
      },
      include: {
        items: {
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: [{ period_end: 'desc' }, { created_at: 'desc' }],
      take,
    });
  }

  async listEvidenceSourceCandidates(
    organizationId: string,
    input: EvidenceSourceCandidateQuery,
  ): Promise<EvidenceSourceCandidateRecord[]> {
    await this.assertClientInOrganization(organizationId, input.clientId);

    const sourceTypes = input.sourceTypes?.length
      ? Array.from(new Set(input.sourceTypes))
      : Array.from(EVIDENCE_SOURCE_CANDIDATE_TYPES);
    const unsupported = sourceTypes.filter((sourceType) => !EVIDENCE_SOURCE_CANDIDATE_TYPES.has(sourceType));
    if (unsupported.length) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        `Unsupported evidence source candidate type: ${unsupported.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const take = Math.min(Math.max(Math.trunc(input.take ?? 100), 1), 100);
    const candidates: EvidenceSourceCandidateRecord[] = [];

    if (sourceTypes.includes(EvidenceSourceTypeGQL.VISIT)) {
      const visits = await (this.prisma as any).visit.findMany({
        where: {
          organization_id: organizationId,
          client_id: input.clientId,
          deleted_at: null,
          scheduled_start: { gte: input.periodStart, lte: input.periodEnd },
        },
        include: {
          carer: {
            select: { first_name: true, last_name: true },
          },
        },
        orderBy: { scheduled_start: 'desc' },
        take,
      });
      candidates.push(...visits.map((visit: any) => this.mapVisitCandidate(visit)));
    }

    if (sourceTypes.includes(EvidenceSourceTypeGQL.CARE_LOG)) {
      const careLogs = await (this.prisma as any).careLog.findMany({
        where: {
          organization_id: organizationId,
          client_id: input.clientId,
          deleted_at: null,
          occurred_at: { gte: input.periodStart, lte: input.periodEnd },
        },
        include: {
          carer: {
            select: { first_name: true, last_name: true },
          },
        },
        orderBy: { occurred_at: 'desc' },
        take,
      });
      candidates.push(...careLogs.map((careLog: any) => this.mapCareLogCandidate(careLog)));
    }

    if (sourceTypes.includes(EvidenceSourceTypeGQL.MEDICATION_ADMINISTRATION)) {
      const medicationAdministrations = await (this.prisma as any).medicationAdministration.findMany({
        where: {
          deleted_at: null,
          scheduled_time: { gte: input.periodStart, lte: input.periodEnd },
          OR: [
            {
              visit: {
                is: {
                  organization_id: organizationId,
                  client_id: input.clientId,
                  deleted_at: null,
                },
              },
            },
            {
              prescription: {
                client: {
                  id: input.clientId,
                  organization_id: organizationId,
                  deleted_at: null,
                },
              },
            },
          ],
        },
        include: {
          visit: {
            include: {
              carer: {
                select: { first_name: true, last_name: true },
              },
            },
          },
        },
        orderBy: { scheduled_time: 'desc' },
        take,
      });
      candidates.push(
        ...medicationAdministrations.map((administration: any) =>
          this.mapMedicationAdministrationCandidate(administration),
        ),
      );
    }

    if (sourceTypes.includes(EvidenceSourceTypeGQL.CONCERN)) {
      const concerns = await (this.prisma as any).concern.findMany({
        where: {
          organization_id: organizationId,
          client_id: input.clientId,
          created_at: { gte: input.periodStart, lte: input.periodEnd },
        },
        orderBy: { created_at: 'desc' },
        take,
      });
      candidates.push(...concerns.map((concern: any) => this.mapConcernCandidate(concern)));
    }

    return candidates
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .slice(0, take);
  }

  async createEvidencePack(organizationId: string, input: CreateEvidencePackInput): Promise<any> {
    await this.assertClientInOrganization(organizationId, input.clientId);
    if (input.carePlanId) {
      await this.assertCarePlanInOrganization(organizationId, input.clientId, input.carePlanId);
    }
    await this.assertEvidenceSourcesInOrganization(organizationId, input.clientId, input.items ?? []);

    const items = input.items ?? [];
    return this.evidencePackModel().create({
      data: {
        organization_id: organizationId,
        client_id: input.clientId,
        care_plan_id: input.carePlanId ?? null,
        status: input.status,
        kind: input.kind ?? 'REGULATORY_REVIEW',
        period_start: input.periodStart,
        period_end: input.periodEnd,
        summary: input.summary ?? null,
        source_refs: input.sourceRefs ?? {},
        generated_by: input.generatedBy ?? 'system',
        published_at: input.publishedAt ?? null,
        items: items.length
          ? {
              create: items.map((item) => ({
                source_type: item.sourceType,
                source_id: item.sourceId ?? null,
                occurred_at: item.occurredAt ?? null,
                headline: item.headline,
                detail: item.detail ?? null,
                metadata: item.metadata ?? null,
              })),
            }
          : undefined,
      },
      include: {
        items: {
          orderBy: { created_at: 'desc' },
        },
      },
    });
  }

  async getEvidencePack(organizationId: string, id: string): Promise<any | null> {
    return this.evidencePackModel().findFirst({
      where: {
        id,
        organization_id: organizationId,
      },
      include: {
        items: {
          orderBy: { created_at: 'desc' },
        },
      },
    });
  }

  async recordEvidencePackExport(
    organizationId: string,
    id: string,
    actorUserId?: string | null,
  ): Promise<any | null> {
    const pack = await this.getEvidencePack(organizationId, id);
    if (!pack) {
      return null;
    }

    await (this.prisma as any).auditLog.create({
      data: {
        user_id: actorUserId ?? null,
        organization_id: organizationId,
        action: 'EVIDENCE_PACK_EXPORTED',
        resource_type: 'EvidencePack',
        resource_id: id,
        new_values: {
          organizationId,
          clientId: pack.client_id,
          carePlanId: pack.care_plan_id,
          kind: pack.kind,
          status: pack.status,
        },
      },
    });

    return pack;
  }

  private async assertClientInOrganization(organizationId: string, clientId: string): Promise<void> {
    const client = await (this.prisma as any).client.findFirst({
      where: {
        id: clientId,
        organization_id: organizationId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!client) {
      this.throwScopedRecordNotFound('Person not found');
    }
  }

  private mapVisitCandidate(visit: any): EvidenceSourceCandidateRecord {
    return {
      id: visit.id,
      sourceType: EvidenceSourceTypeGQL.VISIT,
      title: `Care visit: ${this.formatStatus(visit.status)}`,
      subtitle: `Scheduled ${this.formatDateTime(visit.scheduled_start)} to ${this.formatDateTime(visit.scheduled_end)}`,
      occurredAt: visit.actual_end ?? visit.actual_start ?? visit.scheduled_start,
      createdBy: this.formatName(visit.carer),
      status: visit.status,
      previewText: this.truncateText(visit.notes) ?? 'Visit record selected as inspection-ready evidence.',
    };
  }

  private mapCareLogCandidate(careLog: any): EvidenceSourceCandidateRecord {
    return {
      id: careLog.id,
      sourceType: EvidenceSourceTypeGQL.CARE_LOG,
      title: `Care note: ${this.formatStatus(careLog.category)}`,
      subtitle: careLog.escalated
        ? `Escalated to ${careLog.escalated_to ?? 'care team'}`
        : `Recorded ${this.formatDateTime(careLog.occurred_at)}`,
      occurredAt: careLog.occurred_at,
      createdBy: this.formatName(careLog.carer),
      status: careLog.escalated ? 'ESCALATED' : careLog.category,
      previewText: this.truncateText(careLog.notes) ?? 'Care note selected as inspection-ready evidence.',
    };
  }

  private mapMedicationAdministrationCandidate(administration: any): EvidenceSourceCandidateRecord {
    return {
      id: administration.id,
      sourceType: EvidenceSourceTypeGQL.MEDICATION_ADMINISTRATION,
      title: `Medication support: ${this.formatStatus(administration.status)}`,
      subtitle: `Medication support status ${administration.status}`,
      occurredAt: administration.administered_time ?? administration.scheduled_time,
      createdBy: this.formatName(administration.visit?.carer) ?? administration.administered_by ?? null,
      status: administration.status,
      previewText:
        this.truncateText(administration.notes) ??
        'Medication support outcome selected as inspection-ready evidence.',
    };
  }

  private mapConcernCandidate(concern: any): EvidenceSourceCandidateRecord {
    return {
      id: concern.id,
      sourceType: EvidenceSourceTypeGQL.CONCERN,
      title: `Concern case: ${concern.title}`,
      subtitle: `${this.formatStatus(concern.category)} · ${this.formatStatus(concern.severity)}`,
      occurredAt: concern.resolved_at ?? concern.created_at,
      createdBy: concern.assigned_to_user_id ?? null,
      status: concern.status,
      previewText: this.truncateText(concern.description) ?? 'Concern case selected as inspection-ready evidence.',
    };
  }

  private formatName(person?: { first_name?: string | null; last_name?: string | null } | null): string | null {
    const name = [person?.first_name, person?.last_name].filter(Boolean).join(' ').trim();
    return name || null;
  }

  private formatStatus(value?: string | null): string {
    return (value || 'recorded').replace(/_/g, ' ').toLowerCase();
  }

  private formatDateTime(value?: Date | string | null): string {
    if (!value) {
      return 'not recorded';
    }

    return new Date(value).toISOString();
  }

  private truncateText(value?: string | null): string | null {
    const text = (value || '').trim();
    if (!text) {
      return null;
    }

    return text.length > 220 ? `${text.slice(0, 217)}...` : text;
  }

  private async assertVisitInOrganization(
    organizationId: string,
    clientId: string,
    visitId: string,
  ): Promise<void> {
    const visit = await (this.prisma as any).visit.findFirst({
      where: {
        id: visitId,
        organization_id: organizationId,
        client_id: clientId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!visit) {
      this.throwScopedRecordNotFound('Visit not found');
    }
  }

  private async assertAssessmentInOrganization(
    organizationId: string,
    clientId: string,
    assessmentId: string,
  ): Promise<void> {
    const assessment = await this.assessmentModel().findFirst({
      where: {
        id: assessmentId,
        organization_id: organizationId,
        client_id: clientId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!assessment) {
      this.throwScopedRecordNotFound('Assessment not found');
    }
  }

  private async assertCarePlanInOrganization(
    organizationId: string,
    clientId: string,
    carePlanId: string,
  ): Promise<void> {
    const carePlan = await this.carePlanModel().findFirst({
      where: {
        id: carePlanId,
        organization_id: organizationId,
        client_id: clientId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!carePlan) {
      this.throwScopedRecordNotFound('Care plan not found');
    }
  }

  private async assertEvidenceSourcesInOrganization(
    organizationId: string,
    clientId: string,
    items: NonNullable<CreateEvidencePackInput['items']>,
  ): Promise<void> {
    for (const item of items) {
      if (!item.sourceId || item.sourceType === EvidenceSourceTypeGQL.MANUAL_NOTE) {
        continue;
      }

      switch (item.sourceType) {
        case EvidenceSourceTypeGQL.VISIT:
          await this.assertVisitInOrganization(organizationId, clientId, item.sourceId);
          break;
        case EvidenceSourceTypeGQL.CARE_LOG:
          await this.assertCareLogInOrganization(organizationId, clientId, item.sourceId);
          break;
        case EvidenceSourceTypeGQL.MEDICATION_ADMINISTRATION:
          await this.assertMedicationAdministrationInOrganization(organizationId, clientId, item.sourceId);
          break;
        case EvidenceSourceTypeGQL.ASSESSMENT:
          await this.assertAssessmentInOrganization(organizationId, clientId, item.sourceId);
          break;
        case EvidenceSourceTypeGQL.CARE_PLAN:
          await this.assertCarePlanInOrganization(organizationId, clientId, item.sourceId);
          break;
        case EvidenceSourceTypeGQL.CONCERN:
          await this.assertConcernInOrganization(organizationId, clientId, item.sourceId);
          break;
        default:
          this.throwScopedRecordNotFound('Evidence source not found');
      }
    }
  }

  private async assertCareLogInOrganization(
    organizationId: string,
    clientId: string,
    careLogId: string,
  ): Promise<void> {
    const careLog = await (this.prisma as any).careLog.findFirst({
      where: {
        id: careLogId,
        organization_id: organizationId,
        client_id: clientId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!careLog) {
      this.throwScopedRecordNotFound('Care note not found');
    }
  }

  private async assertMedicationAdministrationInOrganization(
    organizationId: string,
    clientId: string,
    medicationAdministrationId: string,
  ): Promise<void> {
    const administration = await (this.prisma as any).medicationAdministration.findFirst({
      where: {
        id: medicationAdministrationId,
        deleted_at: null,
        OR: [
          {
            visit: {
              is: {
                organization_id: organizationId,
                client_id: clientId,
                deleted_at: null,
              },
            },
          },
          {
            prescription: {
              client: {
                id: clientId,
                organization_id: organizationId,
                deleted_at: null,
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    if (!administration) {
      this.throwScopedRecordNotFound('Medication support record not found');
    }
  }

  private async assertConcernInOrganization(
    organizationId: string,
    clientId: string,
    concernId: string,
  ): Promise<void> {
    const concern = await (this.prisma as any).concern.findFirst({
      where: {
        id: concernId,
        organization_id: organizationId,
        client_id: clientId,
      },
      select: { id: true },
    });

    if (!concern) {
      this.throwScopedRecordNotFound('Concern case not found');
    }
  }

  private throwScopedRecordNotFound(message: string): never {
    throw new BaseHttpException(
      ErrorCode.VALIDATION_FAILED,
      message,
      HttpStatus.NOT_FOUND,
    );
  }

  private assessmentModel(): any {
    return this.requireModel('assessment');
  }

  private carePlanModel(): any {
    return this.requireModel('carePlan');
  }

  private evidencePackModel(): any {
    return this.requireModel('evidencePack');
  }

  private requireModel(modelName: string): any {
    const model = (this.prisma as any)[modelName];
    if (!model) {
      throw new BaseHttpException(
        ErrorCode.FEATURE_NOT_ENABLED,
        'Care planning persistence is not available yet. Run Prisma generate and apply schema migrations.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return model;
  }

  private requireModelWithClient(client: any, modelName: string): any {
    const model = client?.[modelName];
    if (!model) {
      throw new BaseHttpException(
        ErrorCode.FEATURE_NOT_ENABLED,
        'Care planning persistence is not available yet. Run Prisma generate and apply schema migrations.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return model;
  }
}
