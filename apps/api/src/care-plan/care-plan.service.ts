import { BadRequestException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CarePlanStatus, CarePlanVersion } from '@oasis/db';
import { PrismaService } from '@oasis/db';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { CarePlanRepository } from './care-plan.repository';
import { SaveCarePlanDraftInput } from './dto/save-care-plan-draft.input';
import { CarePlanAuditEntryDTO, CarePlanContentDTO, CarePlanDTO, CarePlanVersionDTO } from './dto/care-plan.dto';

type CarePlanRiskItem = {
  title: string;
  guidance: string;
  escalationTrigger: string | null;
};

type CarePlanContent = {
  overview: {
    summary: string;
    strengths: string[];
    preferences: string[];
  };
  goalsAndOutcomes: {
    goals: string[];
    desiredOutcomes: string[];
  };
  dailyRoutines: {
    morning: string;
    midday: string;
    evening: string;
    overnight: string;
  };
  personalCareSupport: {
    bathing: string;
    dressing: string;
    toileting: string;
    grooming: string;
  };
  mobilityAndTransfers: {
    mobilitySummary: string;
    transferGuidance: string;
    equipment: string[];
  };
  nutritionAndHydration: {
    nutritionSummary: string;
    hydrationSupport: string;
    dietaryNeeds: string[];
  };
  medicationSupport: {
    levelOfSupport: string;
    keyInstructions: string;
    refusalEscalation: string;
  };
  communicationAndAccessibility: {
    communicationApproach: string;
    communicationNeeds: string[];
    accessibilityAdjustments: string[];
  };
  risksAndRedFlags: {
    items: CarePlanRiskItem[];
  };
  contingencyAndEscalation: {
    summary: string;
    actions: string[];
    escalationTriggers: string[];
  };
  representativesAndInvolvement: {
    summary: string;
    involvedPeople: string[];
  };
};

@Injectable()
export class CarePlanService {
  private readonly logger = new Logger(CarePlanService.name);

  constructor(
    private readonly carePlanRepository: CarePlanRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getClientCarePlan(clientId: string, userRole: string): Promise<CarePlanDTO | null> {
    this.assertAdmin(userRole);
    const carePlan = await this.carePlanRepository.findByClientId(clientId);
    return carePlan ? this.mapCarePlanToDTO(carePlan) : null;
  }

  async getClientCarePlanHistory(clientId: string, userRole: string): Promise<CarePlanVersionDTO[]> {
    this.assertAdmin(userRole);
    const history = await this.carePlanRepository.findPublishedHistoryByClientId(clientId);
    return history.map((version) => this.mapVersionToDTO(version));
  }

  async getClientCarePlanAuditHistory(clientId: string, userRole: string): Promise<CarePlanAuditEntryDTO[]> {
    this.assertAdmin(userRole);

    const carePlan = await this.carePlanRepository.findByClientId(clientId);
    if (!carePlan) {
      return [];
    }

    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        resource_type: 'care_plan',
        resource_id: carePlan.id,
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    return auditLogs.map((log) => {
      const details = (log.new_values as Record<string, unknown> | null) ?? {};
      return {
        id: log.id,
        action: log.action,
        userId: log.user_id ?? 'unknown',
        versionNumber: typeof details.versionNumber === 'number' ? details.versionNumber : null,
        status: typeof details.status === 'string' ? details.status : null,
        changedSections: Array.isArray(details.changedSections)
          ? details.changedSections.filter((value): value is string => typeof value === 'string')
          : [],
        timestamp: log.timestamp,
      };
    });
  }

  async getActiveVersionForClient(clientId: string): Promise<CarePlanVersionDTO | null> {
    const carePlan = await this.carePlanRepository.findByClientId(clientId);
    const activeVersion = carePlan?.active_version;
    return activeVersion && !activeVersion.deleted_at ? this.mapVersionToDTO(activeVersion) : null;
  }

  async saveDraft(input: SaveCarePlanDraftInput, userId: string, userRole: string): Promise<CarePlanVersionDTO> {
    this.assertAdmin(userRole);

    const client = await this.carePlanRepository.findClientById(input.clientId);
    if (!client) {
      throw new BaseHttpException(
        ErrorCode.CLIENT_NOT_FOUND,
        'Client not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const content = this.normalizeContent(input.content as unknown as Record<string, unknown>);
    let carePlan = await this.carePlanRepository.findByClientId(input.clientId);

    if (!carePlan) {
      await this.carePlanRepository.createCarePlan(input.clientId);
      carePlan = await this.carePlanRepository.findByClientId(input.clientId);
    }

    if (!carePlan) {
      throw new BaseHttpException(
        ErrorCode.CARE_PLAN_NOT_FOUND,
        'Care plan could not be created for this client',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const existingDraft = carePlan.draft_version && !carePlan.draft_version.deleted_at ? carePlan.draft_version : null;

    if (existingDraft && existingDraft.status !== CarePlanStatus.DRAFT) {
      throw new BaseHttpException(
        ErrorCode.CARE_PLAN_DRAFT_NOT_FOUND,
        'Open draft not found',
        HttpStatus.NOT_FOUND,
      );
    }

    let savedVersion: CarePlanVersion;
    let changedSections: string[];
    let action: string;

    if (existingDraft) {
      const previousContent = this.normalizeContent(existingDraft.content as Record<string, unknown>);
      changedSections = this.getChangedSections(previousContent, content);
      savedVersion = await this.carePlanRepository.updateVersion(existingDraft.id, {
        review_due_at: input.reviewDueAt ? new Date(input.reviewDueAt) : null,
        effective_from: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        content: content as never,
        authored_by: userId,
      });
      action = 'UPDATE_CARE_PLAN_DRAFT';
    } else {
      const nextVersionNumber = await this.carePlanRepository.getNextVersionNumber(carePlan.id);
      savedVersion = await this.carePlanRepository.createVersion({
        care_plan_id: carePlan.id,
        version_number: nextVersionNumber,
        status: CarePlanStatus.DRAFT,
        review_due_at: input.reviewDueAt ? new Date(input.reviewDueAt) : null,
        effective_from: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        authored_by: userId,
        content: content as never,
      });
      await this.carePlanRepository.updateCarePlan(carePlan.id, {
        draft_version_id: savedVersion.id,
      });
      changedSections = Object.keys(content);
      action = 'CREATE_CARE_PLAN_DRAFT';
    }

    await this.writeAuditLog({
      userId,
      action,
      clientId: input.clientId,
      carePlanId: carePlan.id,
      version: savedVersion.version_number,
      changedSections,
      status: savedVersion.status,
    });

    return this.mapVersionToDTO(savedVersion);
  }

  async publishDraft(carePlanId: string, userId: string, userRole: string): Promise<CarePlanVersionDTO> {
    this.assertAdmin(userRole);
    const carePlan = await this.carePlanRepository.findById(carePlanId);

    if (!carePlan) {
      throw new BaseHttpException(
        ErrorCode.CARE_PLAN_NOT_FOUND,
        'Care plan not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const draftVersion = carePlan.draft_version && !carePlan.draft_version.deleted_at ? carePlan.draft_version : null;
    if (!draftVersion) {
      throw new BaseHttpException(
        ErrorCode.CARE_PLAN_DRAFT_NOT_FOUND,
        'No open draft is available to publish',
        HttpStatus.NOT_FOUND,
      );
    }

    const normalizedContent = this.normalizeContent(draftVersion.content as Record<string, unknown>);
    if (!draftVersion.review_due_at || !draftVersion.effective_from || !this.isPublishable(normalizedContent)) {
      throw new BadRequestException(
        'Draft care plans need a review date, effective date, and meaningful care guidance before publishing.'
      );
    }

    const approvedAt = new Date();
    const publishedDraft = await this.carePlanRepository.runPublishTransaction({
      carePlanId,
      draftVersionId: draftVersion.id,
      previousActiveVersionId: carePlan.active_version_id,
      approvedBy: userId,
      approvedAt,
    });

    await this.writeAuditLog({
      userId,
      action: 'PUBLISH_CARE_PLAN_DRAFT',
      clientId: carePlan.client_id,
      carePlanId,
      version: publishedDraft.version_number,
      changedSections: this.getMeaningfulSections(normalizedContent),
      status: CarePlanStatus.ACTIVE,
    });

    return this.mapVersionToDTO(publishedDraft);
  }

  async discardDraft(carePlanId: string, userId: string, userRole: string): Promise<CarePlanDTO> {
    this.assertAdmin(userRole);
    const carePlan = await this.carePlanRepository.findById(carePlanId);

    if (!carePlan) {
      throw new BaseHttpException(
        ErrorCode.CARE_PLAN_NOT_FOUND,
        'Care plan not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const draftVersion = carePlan.draft_version && !carePlan.draft_version.deleted_at ? carePlan.draft_version : null;
    if (!draftVersion) {
      throw new BaseHttpException(
        ErrorCode.CARE_PLAN_DRAFT_NOT_FOUND,
        'No open draft is available to discard',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.carePlanRepository.updateVersion(draftVersion.id, {
      deleted_at: new Date(),
    });

    const updatedCarePlan = await this.carePlanRepository.updateCarePlan(carePlan.id, {
      draft_version_id: null,
    });

    await this.writeAuditLog({
      userId,
      action: 'DISCARD_CARE_PLAN_DRAFT',
      clientId: carePlan.client_id,
      carePlanId: carePlan.id,
      version: draftVersion.version_number,
      changedSections: [],
      status: draftVersion.status,
    });

    return this.mapCarePlanToDTO({
      ...updatedCarePlan,
      active_version: carePlan.active_version,
      draft_version: null,
    });
  }

  private assertAdmin(userRole: string) {
    if (userRole !== 'admin') {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ADMIN_ONLY,
        'This action is only available to admin users',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private normalizeString(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeStringList(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return Array.from(
      new Set(
        value
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean)
      )
    );
  }

  private normalizeRiskItems(value: unknown): CarePlanRiskItem[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        const risk = item as Record<string, unknown>;
        const title = this.normalizeString(risk?.title);
        const guidance = this.normalizeString(risk?.guidance);
        const escalationTrigger = this.normalizeString(risk?.escalationTrigger) || null;

        if (!title || !guidance) {
          return null;
        }

        return {
          title,
          guidance,
          escalationTrigger,
        };
      })
      .filter((item): item is CarePlanRiskItem => Boolean(item));
  }

  private emptyContent(): CarePlanContent {
    return {
      overview: {
        summary: '',
        strengths: [],
        preferences: [],
      },
      goalsAndOutcomes: {
        goals: [],
        desiredOutcomes: [],
      },
      dailyRoutines: {
        morning: '',
        midday: '',
        evening: '',
        overnight: '',
      },
      personalCareSupport: {
        bathing: '',
        dressing: '',
        toileting: '',
        grooming: '',
      },
      mobilityAndTransfers: {
        mobilitySummary: '',
        transferGuidance: '',
        equipment: [],
      },
      nutritionAndHydration: {
        nutritionSummary: '',
        hydrationSupport: '',
        dietaryNeeds: [],
      },
      medicationSupport: {
        levelOfSupport: '',
        keyInstructions: '',
        refusalEscalation: '',
      },
      communicationAndAccessibility: {
        communicationApproach: '',
        communicationNeeds: [],
        accessibilityAdjustments: [],
      },
      risksAndRedFlags: {
        items: [],
      },
      contingencyAndEscalation: {
        summary: '',
        actions: [],
        escalationTriggers: [],
      },
      representativesAndInvolvement: {
        summary: '',
        involvedPeople: [],
      },
    };
  }

  private normalizeContent(content: Record<string, unknown> | undefined | null): CarePlanContent {
    const source = content ?? {};
    const overview = (source.overview ?? {}) as Record<string, unknown>;
    const goalsAndOutcomes = (source.goalsAndOutcomes ?? {}) as Record<string, unknown>;
    const dailyRoutines = (source.dailyRoutines ?? {}) as Record<string, unknown>;
    const personalCareSupport = (source.personalCareSupport ?? {}) as Record<string, unknown>;
    const mobilityAndTransfers = (source.mobilityAndTransfers ?? {}) as Record<string, unknown>;
    const nutritionAndHydration = (source.nutritionAndHydration ?? {}) as Record<string, unknown>;
    const medicationSupport = (source.medicationSupport ?? {}) as Record<string, unknown>;
    const communicationAndAccessibility = (source.communicationAndAccessibility ?? {}) as Record<string, unknown>;
    const risksAndRedFlags = (source.risksAndRedFlags ?? {}) as Record<string, unknown>;
    const contingencyAndEscalation = (source.contingencyAndEscalation ?? {}) as Record<string, unknown>;
    const representativesAndInvolvement = (source.representativesAndInvolvement ?? {}) as Record<string, unknown>;

    return {
      overview: {
        summary: this.normalizeString(overview.summary),
        strengths: this.normalizeStringList(overview.strengths),
        preferences: this.normalizeStringList(overview.preferences),
      },
      goalsAndOutcomes: {
        goals: this.normalizeStringList(goalsAndOutcomes.goals),
        desiredOutcomes: this.normalizeStringList(goalsAndOutcomes.desiredOutcomes),
      },
      dailyRoutines: {
        morning: this.normalizeString(dailyRoutines.morning),
        midday: this.normalizeString(dailyRoutines.midday),
        evening: this.normalizeString(dailyRoutines.evening),
        overnight: this.normalizeString(dailyRoutines.overnight),
      },
      personalCareSupport: {
        bathing: this.normalizeString(personalCareSupport.bathing),
        dressing: this.normalizeString(personalCareSupport.dressing),
        toileting: this.normalizeString(personalCareSupport.toileting),
        grooming: this.normalizeString(personalCareSupport.grooming),
      },
      mobilityAndTransfers: {
        mobilitySummary: this.normalizeString(mobilityAndTransfers.mobilitySummary),
        transferGuidance: this.normalizeString(mobilityAndTransfers.transferGuidance),
        equipment: this.normalizeStringList(mobilityAndTransfers.equipment),
      },
      nutritionAndHydration: {
        nutritionSummary: this.normalizeString(nutritionAndHydration.nutritionSummary),
        hydrationSupport: this.normalizeString(nutritionAndHydration.hydrationSupport),
        dietaryNeeds: this.normalizeStringList(nutritionAndHydration.dietaryNeeds),
      },
      medicationSupport: {
        levelOfSupport: this.normalizeString(medicationSupport.levelOfSupport),
        keyInstructions: this.normalizeString(medicationSupport.keyInstructions),
        refusalEscalation: this.normalizeString(medicationSupport.refusalEscalation),
      },
      communicationAndAccessibility: {
        communicationApproach: this.normalizeString(communicationAndAccessibility.communicationApproach),
        communicationNeeds: this.normalizeStringList(communicationAndAccessibility.communicationNeeds),
        accessibilityAdjustments: this.normalizeStringList(communicationAndAccessibility.accessibilityAdjustments),
      },
      risksAndRedFlags: {
        items: this.normalizeRiskItems(risksAndRedFlags.items),
      },
      contingencyAndEscalation: {
        summary: this.normalizeString(contingencyAndEscalation.summary),
        actions: this.normalizeStringList(contingencyAndEscalation.actions),
        escalationTriggers: this.normalizeStringList(contingencyAndEscalation.escalationTriggers),
      },
      representativesAndInvolvement: {
        summary: this.normalizeString(representativesAndInvolvement.summary),
        involvedPeople: this.normalizeStringList(representativesAndInvolvement.involvedPeople),
      },
    };
  }

  private isPublishable(content: CarePlanContent) {
    if (!content.overview.summary) {
      return false;
    }

    const meaningfulSections = this.getMeaningfulSections(content).filter((section) => section !== 'overview');
    return meaningfulSections.length > 0;
  }

  private getMeaningfulSections(content: CarePlanContent) {
    const emptyContent = this.emptyContent();
    return (Object.keys(content) as Array<keyof CarePlanContent>)
      .filter((section) => JSON.stringify(content[section]) !== JSON.stringify(emptyContent[section]))
      .map((section) => section as string);
  }

  private getChangedSections(previousContent: CarePlanContent, nextContent: CarePlanContent) {
    return (Object.keys(nextContent) as Array<keyof CarePlanContent>)
      .filter((section) => JSON.stringify(previousContent[section]) !== JSON.stringify(nextContent[section]))
      .map((section) => section as string);
  }

  private async writeAuditLog(params: {
    userId: string;
    action: string;
    clientId: string;
    carePlanId: string;
    version: number;
    changedSections: string[];
    status: CarePlanStatus;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: params.userId,
          action: params.action,
          resource_type: 'care_plan',
          resource_id: params.carePlanId,
          old_values: {},
          new_values: {
            clientId: params.clientId,
            carePlanId: params.carePlanId,
            versionNumber: params.version,
            changedSections: params.changedSections,
            status: params.status,
          },
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn('Failed to write care-plan audit log', error);
    }
  }

  private mapCarePlanToDTO(carePlan: {
    id: string;
    client_id: string;
    active_version?: CarePlanVersion | null;
    draft_version?: CarePlanVersion | null;
    created_at: Date;
    updated_at: Date;
  }): CarePlanDTO {
    return {
      id: carePlan.id,
      clientId: carePlan.client_id,
      activeVersion: carePlan.active_version ? this.mapVersionToDTO(carePlan.active_version) : null,
      draftVersion: carePlan.draft_version ? this.mapVersionToDTO(carePlan.draft_version) : null,
      createdAt: carePlan.created_at,
      updatedAt: carePlan.updated_at,
    };
  }

  private mapVersionToDTO(version: CarePlanVersion): CarePlanVersionDTO {
    return {
      id: version.id,
      carePlanId: version.care_plan_id,
      versionNumber: version.version_number,
      status: version.status,
      reviewDueAt: version.review_due_at,
      effectiveFrom: version.effective_from,
      authoredBy: version.authored_by,
      approvedBy: version.approved_by,
      approvedAt: version.approved_at,
      content: this.normalizeContent(version.content as Record<string, unknown>) as unknown as CarePlanContentDTO,
      createdAt: version.created_at,
      updatedAt: version.updated_at,
    };
  }
}
