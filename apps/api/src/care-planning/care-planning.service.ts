import { HttpStatus, Injectable } from '@nestjs/common';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';
import {
  assertMedicationEmarEnabled,
  isMedicationEmarEnabled,
} from '../common/features/medication-emar';
import { CarePlanningRepository } from './care-planning.repository';
import {
  AssessmentDTO,
  AssessmentSourceGQL,
  AssessmentStatusGQL,
  CarePlanDTO,
  CarePlanStatusGQL,
  EvidenceItemDTO,
  EvidencePackDTO,
  EvidencePackStatusGQL,
  EvidenceSourceCandidateDTO,
  EvidenceSourceTypeGQL,
} from './dto/care-planning.dto';
import { CreateAssessmentInput } from './dto/create-assessment.input';
import { CreateCarePlanInput } from './dto/create-care-plan.input';
import { CreateEvidencePackInput } from './dto/create-evidence-pack.input';
import { CompleteAssessmentInput } from './dto/complete-assessment.input';
import { ApproveCarePlanInput } from './dto/approve-care-plan.input';
import { ArchiveCarePlanInput } from './dto/archive-care-plan.input';
import { EvidenceSourceCandidatesInput } from './dto/evidence-source-candidates.input';

interface CarePlanningViewer {
  role: string;
  organizationId?: string | null;
  userId?: string | null;
}

const SUPPORTED_EVIDENCE_CANDIDATE_SOURCE_TYPES = new Set<EvidenceSourceTypeGQL>([
  EvidenceSourceTypeGQL.VISIT,
  EvidenceSourceTypeGQL.CARE_LOG,
  EvidenceSourceTypeGQL.MEDICATION_ADMINISTRATION,
  EvidenceSourceTypeGQL.CONCERN,
]);

@Injectable()
export class CarePlanningService {
  constructor(private readonly repository: CarePlanningRepository) {}

  async listAssessments(clientId: string, take: number, viewer: CarePlanningViewer): Promise<AssessmentDTO[]> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertReadAccess(viewer.role);

    const records = await this.withSchemaGuard(() => this.repository.listAssessments(organizationId, clientId, take));
    return records.map((record) => this.mapAssessment(record));
  }

  async createAssessment(input: CreateAssessmentInput, viewer: CarePlanningViewer): Promise<AssessmentDTO> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertWriteAccess(viewer.role);
    const actorId = this.requireActorId(viewer.userId);

    const record = await this.withSchemaGuard(() =>
      this.repository.createAssessment(organizationId, {
        ...input,
        assessorId: actorId,
      }),
    );
    return this.mapAssessment(record);
  }

  async getAssessment(id: string, viewer: CarePlanningViewer): Promise<AssessmentDTO> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertReadAccess(viewer.role);

    const record = await this.withSchemaGuard(() => this.repository.getAssessment(organizationId, id));
    if (!record) {
      throw new BaseHttpException(ErrorCode.VALIDATION_FAILED, 'Assessment not found', HttpStatus.NOT_FOUND);
    }

    return this.mapAssessment(record);
  }

  async completeAssessment(input: CompleteAssessmentInput, viewer: CarePlanningViewer): Promise<AssessmentDTO> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertWriteAccess(viewer.role);
    const actorId = this.requireActorId(viewer.userId);

    const record = await this.withSchemaGuard(() =>
      this.repository.completeAssessment(organizationId, {
        ...input,
        assessorId: actorId,
      }),
    );
    if (!record) {
      throw new BaseHttpException(ErrorCode.VALIDATION_FAILED, 'Assessment not found', HttpStatus.NOT_FOUND);
    }

    return this.mapAssessment(record);
  }

  async listCarePlans(clientId: string, take: number, viewer: CarePlanningViewer): Promise<CarePlanDTO[]> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertReadAccess(viewer.role);

    const records = await this.withSchemaGuard(() => this.repository.listCarePlans(organizationId, clientId, take));
    return records.map((record) => this.mapCarePlan(record));
  }

  async createCarePlan(input: CreateCarePlanInput, viewer: CarePlanningViewer): Promise<CarePlanDTO> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertWriteAccess(viewer.role);
    const actorId = this.requireActorId(viewer.userId);

    const record = await this.withSchemaGuard(() =>
      this.repository.createCarePlan(organizationId, {
        ...input,
        authoredById: actorId,
        approvedById: undefined,
        approvedAt: undefined,
      }),
    );
    return this.mapCarePlan(record);
  }

  async getCarePlan(id: string, viewer: CarePlanningViewer): Promise<CarePlanDTO> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertReadAccess(viewer.role);

    const record = await this.withSchemaGuard(() => this.repository.getCarePlan(organizationId, id));
    if (!record) {
      throw new BaseHttpException(ErrorCode.VALIDATION_FAILED, 'Care plan not found', HttpStatus.NOT_FOUND);
    }

    return this.mapCarePlan(record);
  }

  async approveCarePlan(input: ApproveCarePlanInput, viewer: CarePlanningViewer): Promise<CarePlanDTO> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertWriteAccess(viewer.role);
    const actorId = this.requireActorId(viewer.userId);

    const record = await this.withSchemaGuard(() =>
      this.repository.approveCarePlan(organizationId, {
        ...input,
        approvedById: actorId,
      }),
    );
    if (!record) {
      throw new BaseHttpException(ErrorCode.VALIDATION_FAILED, 'Care plan not found', HttpStatus.NOT_FOUND);
    }

    return this.mapCarePlan(record);
  }

  async archiveCarePlan(input: ArchiveCarePlanInput, viewer: CarePlanningViewer): Promise<CarePlanDTO> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertWriteAccess(viewer.role);

    const record = await this.withSchemaGuard(() => this.repository.archiveCarePlan(organizationId, input));
    if (!record) {
      throw new BaseHttpException(ErrorCode.VALIDATION_FAILED, 'Care plan not found', HttpStatus.NOT_FOUND);
    }

    return this.mapCarePlan(record);
  }

  async listEvidencePacks(clientId: string, take: number, viewer: CarePlanningViewer): Promise<EvidencePackDTO[]> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertReadAccess(viewer.role);

    const records = await this.withSchemaGuard(() => this.repository.listEvidencePacks(organizationId, clientId, take));
    return records
      .filter((record) => !this.containsExcludedMedicationEvidence(record))
      .map((record) => this.mapEvidencePack(record));
  }

  async evidenceSourceCandidates(
    input: EvidenceSourceCandidatesInput,
    viewer: CarePlanningViewer,
  ): Promise<EvidenceSourceCandidateDTO[]> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertReadAccess(viewer.role);

    const sourceTypes = this.normalizeCandidateSourceTypes(input.sourceTypes);
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart > periodEnd) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'A valid evidence source period is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const candidates = await this.withSchemaGuard(() =>
      this.repository.listEvidenceSourceCandidates(organizationId, {
        clientId: input.clientId,
        periodStart,
        periodEnd,
        sourceTypes,
        take: this.normalizeTake(input.take),
      }),
    );
    return candidates.filter(
      (candidate) => !this.containsExcludedMedicationEvidence(candidate),
    );
  }

  async createEvidencePack(input: CreateEvidencePackInput, viewer: CarePlanningViewer): Promise<EvidencePackDTO> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertWriteAccess(viewer.role);
    const actorId = this.requireActorId(viewer.userId);
    if (this.containsExcludedMedicationEvidence(input)) {
      assertMedicationEmarEnabled();
    }

    const record = await this.withSchemaGuard(() =>
      this.repository.createEvidencePack(organizationId, {
        ...input,
        generatedBy: actorId,
      }),
    );
    return this.mapEvidencePack(record);
  }

  async getEvidencePack(id: string, viewer: CarePlanningViewer): Promise<EvidencePackDTO> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertReadAccess(viewer.role);

    const record = await this.withSchemaGuard(() => this.repository.getEvidencePack(organizationId, id));
    if (!record) {
      throw new BaseHttpException(ErrorCode.VALIDATION_FAILED, 'Evidence pack not found', HttpStatus.NOT_FOUND);
    }
    if (this.containsExcludedMedicationEvidence(record)) {
      assertMedicationEmarEnabled();
    }

    return this.mapEvidencePack(record);
  }

  async recordEvidencePackExport(id: string, viewer: CarePlanningViewer): Promise<EvidencePackDTO> {
    const organizationId = this.requireOrganizationId(viewer.organizationId);
    this.assertWriteAccess(viewer.role);

    const existing = await this.withSchemaGuard(() =>
      this.repository.getEvidencePack(organizationId, id),
    );
    if (!existing) {
      throw new BaseHttpException(ErrorCode.VALIDATION_FAILED, 'Evidence pack not found', HttpStatus.NOT_FOUND);
    }
    if (this.containsExcludedMedicationEvidence(existing)) {
      assertMedicationEmarEnabled();
    }

    const record = await this.withSchemaGuard(() =>
      this.repository.recordEvidencePackExport(organizationId, id, viewer.userId ?? undefined),
    );
    if (!record) {
      throw new BaseHttpException(ErrorCode.VALIDATION_FAILED, 'Evidence pack not found', HttpStatus.NOT_FOUND);
    }

    return this.mapEvidencePack(record);
  }

  private mapAssessment(record: any): AssessmentDTO {
    return {
      id: record.id,
      organizationId: record.organization_id,
      clientId: record.client_id,
      visitId: record.visit_id,
      status: record.status as AssessmentStatusGQL,
      source: record.source as AssessmentSourceGQL,
      title: record.title,
      summary: record.summary,
      findings: (record.findings || {}) as Record<string, unknown>,
      riskFlags: (record.risk_flags || null) as Record<string, unknown> | null,
      recommendedActions: (record.recommended_actions || null) as Record<string, unknown> | null,
      assessorId: record.assessor_id,
      completedAt: record.completed_at,
      reviewDueAt: record.review_due_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private mapCarePlan(record: any): CarePlanDTO {
    return {
      id: record.id,
      organizationId: record.organization_id,
      clientId: record.client_id,
      assessmentId: record.assessment_id,
      status: record.status as CarePlanStatusGQL,
      version: record.version,
      title: record.title,
      goals: (record.goals || {}) as Record<string, unknown>,
      interventions: (record.interventions || {}) as Record<string, unknown>,
      safetyNotes: record.safety_notes,
      effectiveFrom: record.effective_from,
      effectiveTo: record.effective_to,
      reviewDueAt: record.review_due_at,
      authoredById: record.authored_by_id,
      approvedById: record.approved_by_id,
      approvedAt: record.approved_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private mapEvidencePack(record: any): EvidencePackDTO {
    const items = Array.isArray(record.items) ? record.items.map((item: any) => this.mapEvidenceItem(item)) : [];

    return {
      id: record.id,
      organizationId: record.organization_id,
      clientId: record.client_id,
      carePlanId: record.care_plan_id,
      status: record.status as EvidencePackStatusGQL,
      kind: record.kind,
      periodStart: record.period_start,
      periodEnd: record.period_end,
      summary: (record.summary || null) as Record<string, unknown> | null,
      sourceRefs: (record.source_refs || {}) as Record<string, unknown>,
      generatedBy: record.generated_by,
      generatedAt: record.generated_at,
      publishedAt: record.published_at,
      items,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private mapEvidenceItem(record: any): EvidenceItemDTO {
    return {
      id: record.id,
      evidencePackId: record.evidence_pack_id,
      sourceType: record.source_type as EvidenceSourceTypeGQL,
      sourceId: record.source_id,
      occurredAt: record.occurred_at,
      headline: record.headline,
      detail: record.detail,
      metadata: (record.metadata || null) as Record<string, unknown> | null,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private normalizeCandidateSourceTypes(sourceTypes?: EvidenceSourceTypeGQL[] | null): EvidenceSourceTypeGQL[] {
    const requested = sourceTypes?.length
      ? Array.from(new Set(sourceTypes))
      : Array.from(SUPPORTED_EVIDENCE_CANDIDATE_SOURCE_TYPES);

    if (
      !isMedicationEmarEnabled() &&
      requested.includes(EvidenceSourceTypeGQL.MEDICATION_ADMINISTRATION)
    ) {
      if (sourceTypes?.length) {
        assertMedicationEmarEnabled();
      }
      return requested.filter(
        (sourceType) =>
          sourceType !== EvidenceSourceTypeGQL.MEDICATION_ADMINISTRATION,
      );
    }

    const unsupported = requested.filter((sourceType) => !SUPPORTED_EVIDENCE_CANDIDATE_SOURCE_TYPES.has(sourceType));
    if (unsupported.length) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        `Unsupported evidence source candidate type: ${unsupported.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return requested;
  }

  private containsExcludedMedicationEvidence(value: unknown): boolean {
    if (isMedicationEmarEnabled() || value === null || value === undefined) {
      return false;
    }
    try {
      return /medication|\bemar\b/i.test(JSON.stringify(value));
    } catch {
      return true;
    }
  }

  private normalizeTake(take?: number | null): number {
    if (!Number.isFinite(take ?? NaN)) {
      return 100;
    }

    return Math.min(Math.max(Math.trunc(take as number), 1), 100);
  }

  private assertReadAccess(role: string): void {
    const normalizedRole = this.normalizeRole(role);
    if (normalizedRole !== 'admin') {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ROLE_REQUIRED,
        'Administrator access required',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private assertWriteAccess(role: string): void {
    const normalizedRole = this.normalizeRole(role);
    if (normalizedRole !== 'admin') {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'Only administrators can update assessment-led care planning records',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private normalizeRole(role: string): string {
    return (role || '').toLowerCase().trim();
  }

  private requireOrganizationId(organizationId?: string | null): string {
    const orgId = (organizationId || '').trim();
    if (orgId) {
      return orgId;
    }
    throw new BaseHttpException(
      ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
      'Organization context is required for care-planning operations',
      HttpStatus.FORBIDDEN,
    );
  }

  private requireActorId(userId?: string | null): string {
    const actorId = (userId || '').trim();
    if (actorId) {
      return actorId;
    }
    throw new BaseHttpException(
      ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
      'Verified actor identity is required for care-planning operations',
      HttpStatus.FORBIDDEN,
    );
  }

  private async withSchemaGuard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof BaseHttpException) {
        throw error;
      }

      if (this.isMissingSchemaError(error)) {
        throw new BaseHttpException(
          ErrorCode.FEATURE_NOT_ENABLED,
          'Care-planning persistence tables are not available in this environment yet. Apply the Prisma migration first.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw error;
    }
  }

  private isMissingSchemaError(error: unknown): boolean {
    const code = (error as { code?: string })?.code;
    if (code === 'P2021' || code === 'P2022') {
      return true;
    }

    const message = (error as { message?: string })?.message;
    if (!message) {
      return false;
    }

    return message.includes('does not exist') || message.includes('Unknown arg');
  }
}
