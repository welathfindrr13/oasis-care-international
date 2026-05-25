import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { AiSummaryRepository } from './ai-summary.repository';
import { MedicationRepository } from '../medication/medication.repository';
import { GenerateSummaryInput } from './dto/generate-summary.input';
import { ApproveSummaryInput } from './dto/approve-summary.input';
import { HealthSummaryFilterArgs } from './dto/health-summary-filter.args';
import { HealthSummary, MedicationAuditAction, Prisma, PrismaService } from '@oasis/db';
import { ClsService } from 'nestjs-cls';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import * as fs from 'fs';
import * as path from 'path';

type RiskLevel = 'green' | 'amber' | 'red';

type CareLogForModel = {
  timestamp: string;
  type: 'visit' | 'task' | 'medication';
  data: Record<string, unknown>;
};

@Injectable()
export class AiSummaryService {
  private readonly logger = new Logger(AiSummaryService.name);
  private readonly bedrock: BedrockRuntimeClient;
  private readonly summaryModelId: string;
  private readonly fallbackModelIds: string[];
  private readonly summaryPromptTemplate: string;

  private initBedrockClient(): BedrockRuntimeClient {
    return new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'eu-west-2',
    });
  }

  private loadPromptTemplate(): string {
    const candidatePaths = [
      path.join(process.cwd(), 'prompts', 'health-summary.md'),
      path.join(process.cwd(), 'apps', 'api', 'prompts', 'health-summary.md'),
      '/app/apps/api/prompts/health-summary.md',
    ];

    for (const promptPath of candidatePaths) {
      if (fs.existsSync(promptPath)) {
        return fs.readFileSync(promptPath, 'utf8');
      }
    }

    this.logger.warn('Health summary prompt template missing; using fallback prompt');
    return 'You are a clinical AI assistant. Return valid JSON only.';
  }

  constructor(
    private readonly aiSummaryRepository: AiSummaryRepository,
    private readonly medicationRepository: MedicationRepository,
    private readonly cls: ClsService,
    private readonly prisma: PrismaService,
  ) {
    this.summaryModelId = process.env.BEDROCK_MODEL || 'anthropic.claude-3-haiku-20240307-v1:0';
    this.fallbackModelIds = this.parseFallbackModelIds();
    this.bedrock = this.initBedrockClient();
    this.summaryPromptTemplate = this.loadPromptTemplate();
  }

  async generateSummary(
    data: GenerateSummaryInput,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<HealthSummary> {
    const orgId = await this.requireOrganizationId(organizationId);
    const requestId = this.cls.get('requestId');
    this.logger.log(`Generating AI summary for client ${data.clientId}`, { requestId });
    this.validateGenerationPreflight();

    // Check if AI summary is enabled for this client's organization
    const aiEnabled = await this.aiSummaryRepository.checkOrganizationAIEnabled(data.clientId, orgId);
    if (!aiEnabled) {
      throw new BaseHttpException(
        ErrorCode.FEATURE_NOT_ENABLED,
        'AI summary feature is not enabled for this organization',
        HttpStatus.FORBIDDEN
      );
    }

    // Check if summary already exists for this period
    const existingSummary = await this.aiSummaryRepository.findByClientAndPeriod(
      data.clientId,
      new Date(data.periodStart),
      new Date(data.periodEnd),
      orgId,
    );

    if (existingSummary && !this.isSummaryExpired(existingSummary)) {
      this.logger.warn(`Summary already exists for period`, { 
        requestId, 
        existingSummaryId: existingSummary.id 
      });
      return existingSummary;
    }

    const periodStart = new Date(data.periodStart);
    const periodEnd = new Date(data.periodEnd);
    const logs = await this.collectCareLogs(data.clientId, periodStart, periodEnd, orgId);
    const generatedSummary = await this.generateSummaryFromModel(periodStart, periodEnd, logs);
    const riskLevels = this.calculateRiskLevels(generatedSummary);

    const summary = await this.aiSummaryRepository.create({
      client: { connect: { id: data.clientId } },
      period_start: periodStart,
      period_end: periodEnd,
      summary_json: generatedSummary as Prisma.InputJsonValue,
      risk_levels: riskLevels as Prisma.InputJsonValue,
      generated_at: new Date(),
      generated_by: 'ai',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Audit: Log AI summary generation
    await this.medicationRepository.createMedicationAudit({
      action: MedicationAuditAction.AI_SUMMARY_GENERATED,
      actorId: 'system',
      actorRole: 'ai',
      changes: {
        summaryId: summary.id,
        clientId: data.clientId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        riskLevels,
        logsAnalysed: logs.length,
        modelId: this.summaryModelId,
      },
    });

    this.logger.log(`AI summary ${summary.id} generated successfully`, { requestId });
    return summary;
  }

  async setOrganizationAIEnabledForClient(
    clientId: string,
    enabled: boolean,
    userRole: string,
    organizationId?: string,
  ): Promise<boolean> {
    const orgId = await this.requireOrganizationId(organizationId);
    if (userRole !== 'admin' && userRole !== 'manager') {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ROLE_REQUIRED,
        'Only managers and admins can change AI summary feature settings',
        HttpStatus.FORBIDDEN,
      );
    }

    const updated = await this.aiSummaryRepository.setOrganizationAIEnabledByClientId(
      clientId,
      enabled,
      orgId,
    );

    if (!updated) {
      throw new BaseHttpException(
        ErrorCode.CLIENT_NOT_FOUND,
        'Client not found or not linked to an organization',
        HttpStatus.NOT_FOUND,
      );
    }

    return true;
  }

  async isOrganizationAIEnabledForClient(clientId: string, organizationId?: string): Promise<boolean> {
    const orgId = await this.requireOrganizationId(organizationId);
    return this.aiSummaryRepository.checkOrganizationAIEnabled(clientId, orgId);
  }

  async listPendingSummaries(
    skip?: number,
    take?: number,
    userId?: string,
    userRole?: string,
    organizationId?: string,
  ): Promise<{ items: HealthSummary[]; total: number }> {
    const orgId = await this.requireOrganizationId(organizationId);
    const requestId = this.cls.get('requestId');
    
    // Only managers and admins can view pending summaries
    if (userRole !== 'admin' && userRole !== 'manager') {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ROLE_REQUIRED,
        'Only managers and admins can view pending summaries',
        HttpStatus.FORBIDDEN
      );
    }

    this.logger.log(`Listing pending AI summaries`, { requestId, userRole });
    
    return this.aiSummaryRepository.findPending({ skip, take }, orgId);
  }

  async listHistory(
    filter: HealthSummaryFilterArgs,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<{ items: HealthSummary[]; total: number }> {
    const orgId = await this.requireOrganizationId(organizationId);
    const requestId = this.cls.get('requestId');
    const where: any = {};

    // Apply role-based filtering
    if (userRole === 'carer') {
      // Carers can only see summaries for their clients (we'd need to check visit assignments)
      // For now, restrict access
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
        'Carers have limited access to summary history',
        HttpStatus.FORBIDDEN
      );
    } else if (userRole === 'client') {
      // Clients can only see their own summaries
      where.client_id = userId;
    }

    // Apply additional filters
    if (filter.clientId) {
      if (userRole === 'client' && filter.clientId !== userId) {
        throw new BaseHttpException(
          ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
          'You can only view your own summaries',
          HttpStatus.FORBIDDEN
        );
      }
      where.client_id = filter.clientId;
    }

    if (filter.status) {
      // Map status filter to database fields
      if (filter.status === 'PENDING') {
        where.approved_by = null;
        where.expires_at = { gt: new Date() };
      } else if (filter.status === 'APPROVED') {
        where.approved_by = { not: null };
        where.feedback = { not: 'rejected' };
      } else if (filter.status === 'REJECTED') {
        where.approved_by = { not: null };
        where.feedback = 'rejected';
      }
    }

    if (filter.periodStartFrom || filter.periodStartTo) {
      where.period_start = {};
      if (filter.periodStartFrom) {
        where.period_start.gte = new Date(filter.periodStartFrom);
      }
      if (filter.periodStartTo) {
        where.period_start.lte = new Date(filter.periodStartTo);
      }
    }

    if (filter.periodEndFrom || filter.periodEndTo) {
      where.period_end = {};
      if (filter.periodEndFrom) {
        where.period_end.gte = new Date(filter.periodEndFrom);
      }
      if (filter.periodEndTo) {
        where.period_end.lte = new Date(filter.periodEndTo);
      }
    }

    this.logger.log(`Finding summaries with filter`, { requestId, where });

    return this.aiSummaryRepository.findMany({
      where,
      skip: filter.skip,
      take: filter.take || 20,
      orderBy: { generated_at: 'desc' },
    }, orgId);
  }

  async approveSummary(
    data: ApproveSummaryInput,
    userId: string,
    userRole: string,
    userEmail?: string,
    organizationId?: string,
  ): Promise<HealthSummary> {
    const orgId = await this.requireOrganizationId(organizationId);
    const requestId = this.cls.get('requestId');
    
    // Only managers and admins can approve summaries
    if (userRole !== 'admin' && userRole !== 'manager') {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ROLE_REQUIRED,
        'Only managers and admins can approve summaries',
        HttpStatus.FORBIDDEN
      );
    }

    const summary = await this.aiSummaryRepository.findById(data.summaryId, orgId);
    if (!summary) {
      throw new BaseHttpException(
        ErrorCode.SUMMARY_NOT_FOUND,
        'Summary not found',
        HttpStatus.NOT_FOUND
      );
    }

    // Check if summary is already approved/rejected
    if (summary.approved_by) {
      throw new BaseHttpException(
        ErrorCode.SUMMARY_ALREADY_PROCESSED,
        'Summary has already been processed',
        HttpStatus.CONFLICT
      );
    }

    // Check if summary has expired
    if (this.isSummaryExpired(summary)) {
      throw new BaseHttpException(
        ErrorCode.SUMMARY_EXPIRED,
        'Summary has expired and cannot be approved',
        HttpStatus.CONFLICT
      );
    }

    // Check if AI is enabled for this client
    const aiEnabled = await this.aiSummaryRepository.checkOrganizationAIEnabled(summary.client_id, orgId);
    if (!aiEnabled) {
      throw new BaseHttpException(
        ErrorCode.FEATURE_NOT_ENABLED,
        'AI summary feature is not enabled for this organization',
        HttpStatus.FORBIDDEN
      );
    }

    const approverId = await this.resolveApproverId(userId, userEmail, orgId);

    this.logger.log(`Approving summary ${data.summaryId}`, { 
      requestId, 
      feedback: data.feedback,
      approverId,
    });

    const approvedSummary = await this.aiSummaryRepository.approve(data.summaryId, approverId, data.feedback);

    // Audit: Log AI summary approval/rejection
    const auditAction = data.feedback === 'rejected' 
      ? MedicationAuditAction.AI_SUMMARY_REJECTED 
      : MedicationAuditAction.AI_SUMMARY_APPROVED;

    await this.medicationRepository.createMedicationAudit({
      action: auditAction,
      actorId: userId,
      actorRole: userRole,
      changes: {
        summaryId: data.summaryId,
        clientId: summary.client_id,
        feedback: data.feedback,
        approvedAt: new Date().toISOString(),
      },
    });

    return approvedSummary;
  }

  private async resolveApproverId(
    userId: string,
    userEmail: string | undefined,
    organizationId: string,
  ): Promise<string> {
    const existingById = await this.prisma.carer.findFirst({
      where: this.prisma.whereNotDeleted({
        id: userId,
        organization_id: organizationId,
      }),
      select: { id: true },
    });
    if (existingById) {
      return existingById.id;
    }

    const normalizedEmail = userEmail?.trim().toLowerCase() || `${userId}@approver.local`;
    const existingByEmail = await this.prisma.carer.findFirst({
      where: this.prisma.whereNotDeleted({
        email: normalizedEmail,
        organization_id: organizationId,
      }),
      select: { id: true },
    });
    if (existingByEmail) {
      return existingByEmail.id;
    }

    const firstName = normalizedEmail.split('@')[0] || 'Approver';
    try {
      const created = await this.prisma.carer.create({
        data: {
          id: userId,
          organization_id: organizationId,
          first_name: firstName,
          last_name: 'Approver',
          email: normalizedEmail,
          phone: null,
          is_active: true,
        },
        select: { id: true },
      });
      return created.id;
    } catch (error) {
      // Handle race where another request created the same approver email.
      const retryByEmail = await this.prisma.carer.findFirst({
        where: this.prisma.whereNotDeleted({
          email: normalizedEmail,
          organization_id: organizationId,
        }),
        select: { id: true },
      });
      if (retryByEmail) {
        return retryByEmail.id;
      }
      throw error;
    }
  }

  async getCurrentWeekSummary(
    clientId: string,
    userId: string,
    userRole: string,
    organizationId?: string,
  ): Promise<HealthSummary | null> {
    const orgId = await this.requireOrganizationId(organizationId);
    // Check access permissions
    if (userRole === 'client' && clientId !== userId) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'You can only view your own summaries',
        HttpStatus.FORBIDDEN
      );
    }

    // Check if AI is enabled
    const aiEnabled = await this.aiSummaryRepository.checkOrganizationAIEnabled(clientId, orgId);
    if (!aiEnabled) {
      return null;
    }

    return this.aiSummaryRepository.findCurrentWeekSummary(clientId, orgId);
  }

  private async requireOrganizationId(organizationId?: string): Promise<string> {
    const orgId = (organizationId || '').trim();
    if (orgId) {
      return orgId;
    }

    throw new BaseHttpException(
      ErrorCode.FORBIDDEN_INSUFFICIENT_PERMISSIONS,
      'Organization context is required for this request',
      HttpStatus.FORBIDDEN,
    );
  }

  private isSummaryExpired(summary: HealthSummary): boolean {
    return new Date() > summary.expires_at;
  }

  private async collectCareLogs(
    clientId: string,
    periodStart: Date,
    periodEnd: Date,
    organizationId: string,
  ): Promise<CareLogForModel[]> {
    const visits = await this.prisma.visit.findMany({
      where: this.prisma.whereNotDeleted({
        organization_id: organizationId,
        client_id: clientId,
        scheduled_start: {
          gte: periodStart,
          lte: periodEnd,
        },
      }),
      include: {
        tasks: {
          where: { deleted_at: null },
        },
        medication_administrations: {
          where: { deleted_at: null },
          include: {
            prescription: {
              include: {
                medication: true,
              },
            },
          },
        },
      },
      orderBy: { scheduled_start: 'asc' },
    });

    return visits.flatMap((visit) => [
      {
        timestamp: visit.scheduled_start.toISOString(),
        type: 'visit' as const,
        data: {
          status: visit.status,
          notes: visit.notes,
          scheduledStart: visit.scheduled_start.toISOString(),
          scheduledEnd: visit.scheduled_end.toISOString(),
          actualStart: visit.actual_start?.toISOString() ?? null,
          actualEnd: visit.actual_end?.toISOString() ?? null,
        },
      },
      ...visit.tasks.map((task) => ({
        timestamp: (task.completed_at || visit.scheduled_start).toISOString(),
        type: 'task' as const,
        data: {
          taskName: task.task_name,
          completed: task.is_completed,
          notes: task.notes,
          completedAt: task.completed_at?.toISOString() ?? null,
        },
      })),
      ...visit.medication_administrations.map((med) => ({
        timestamp: (med.administered_time || med.scheduled_time).toISOString(),
        type: 'medication' as const,
        data: {
          medication: med.prescription?.medication?.name ?? 'Unknown',
          dosage: med.prescription?.medication
            ? `${med.prescription.medication.dosage} ${med.prescription.medication.unit}`
            : null,
          status: med.status,
          scheduledTime: med.scheduled_time.toISOString(),
          administeredTime: med.administered_time?.toISOString() ?? null,
          notes: med.notes,
        },
      })),
    ]);
  }

  private async generateSummaryFromModel(
    periodStart: Date,
    periodEnd: Date,
    logs: CareLogForModel[],
  ): Promise<Record<string, unknown>> {
    const prompt = `${this.summaryPromptTemplate}

## Client Data for Analysis
Period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}
Care Logs:
${JSON.stringify(logs, null, 2)}

Return valid JSON only.`;

    const modelCandidates = [this.summaryModelId, ...this.fallbackModelIds].filter(
      (value, index, array) => Boolean(value) && array.indexOf(value) === index,
    );
    let lastError: unknown;

    for (const modelId of modelCandidates) {
      try {
        const summaryText = await this.invokeSummaryModel(modelId, prompt);
        const parsedSummary = this.parseJsonFromModel(summaryText);
        if (!parsedSummary || typeof parsedSummary !== 'object' || Array.isArray(parsedSummary)) {
          throw new Error('AI response did not contain a valid JSON object');
        }

        if (modelId !== this.summaryModelId) {
          this.logger.warn(`AI summary generated using fallback model`, {
            configuredModel: this.summaryModelId,
            usedModel: modelId,
          });
        }

        return parsedSummary as Record<string, unknown>;
      } catch (error: any) {
        lastError = error;
        const reason = this.mapBedrockFailureReason(error);
        this.logger.error('Bedrock summary generation failed', {
          message: error?.message,
          name: error?.name,
          reason,
          modelId,
        });
      }
    }

    const reason = this.mapBedrockFailureReason(lastError);
    throw new BaseHttpException(
      ErrorCode.INTERNAL_ERROR,
      `AI summary generation failed (${reason}). Verify Bedrock access and model configuration.`,
      HttpStatus.BAD_GATEWAY,
    );
  }

  private validateGenerationPreflight(): void {
    const modelId = String(this.summaryModelId || '').trim();
    const region = String(process.env.AWS_REGION || '').trim();
    if (!modelId) {
      throw new BaseHttpException(
        ErrorCode.INTERNAL_ERROR,
        'AI summary generation is misconfigured (missing BEDROCK_MODEL).',
        HttpStatus.BAD_GATEWAY,
      );
    }
    if (!region) {
      throw new BaseHttpException(
        ErrorCode.INTERNAL_ERROR,
        'AI summary generation is misconfigured (missing AWS_REGION).',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private mapBedrockFailureReason(error: unknown): string {
    const message = String((error as any)?.message || '').toLowerCase();
    const name = String((error as any)?.name || '').toLowerCase();
    if (message.includes('use case details have not been submitted')) {
      return 'bedrock model access not enabled';
    }
    if (name.includes('accessdenied')) return 'bedrock access denied';
    if (name.includes('validation')) return 'bedrock request validation failed';
    if (name.includes('throttl')) return 'bedrock throttled';
    if (name.includes('timeout')) return 'bedrock timeout';
    if (name.includes('credentials')) return 'aws credentials unavailable';
    return 'bedrock invocation failed';
  }

  private parseFallbackModelIds(): string[] {
    const fromEnv = String(process.env.BEDROCK_MODEL_FALLBACKS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return fromEnv;
  }

  private async invokeSummaryModel(modelId: string, prompt: string): Promise<string> {
    const command = new ConverseCommand({
      modelId,
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
      inferenceConfig: {
        maxTokens: 2000,
        temperature: 0.1,
      },
    });

    const response = await this.bedrock.send(command);
    const text = (response.output?.message?.content || [])
      .map((entry: any) => String(entry?.text || '').trim())
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!text) {
      throw new Error('AI model returned empty content');
    }
    return text;
  }

  private parseJsonFromModel(summaryText: string): unknown {
    const jsonBlockMatch = summaryText.match(/```json\s*([\s\S]*?)\s*```/i);
    const payload = jsonBlockMatch?.[1] || summaryText;

    try {
      return JSON.parse(payload);
    } catch {
      const objectMatch = payload.match(/\{[\s\S]*\}/);
      if (!objectMatch) {
        throw new Error('No JSON object found in AI response');
      }
      return JSON.parse(objectMatch[0]);
    }
  }

  private calculateRiskLevels(summary: Record<string, unknown>): Record<string, RiskLevel> {
    const base: Record<string, RiskLevel> = {
      overall: 'green',
      mobility: 'green',
      medication: 'green',
      mental_health: 'green',
      nutrition: 'green',
      safety: 'green',
    };

    const allRiskLevels: RiskLevel[] = [];

    const readRisksFromSection = (section: unknown): RiskLevel[] => {
      if (!Array.isArray(section)) return [];
      return section
        .map((item) => String((item as any)?.riskLevel || '').toLowerCase())
        .filter((risk): risk is RiskLevel => risk === 'green' || risk === 'amber' || risk === 'red');
    };

    const vitalsRisks = readRisksFromSection(summary.vitals);
    const toiletingRisks = readRisksFromSection(summary.toileting);
    const medRisks = readRisksFromSection(summary.missedMeds);
    const genericRisks = Array.isArray(summary.risks) ? summary.risks : [];

    allRiskLevels.push(...vitalsRisks, ...toiletingRisks, ...medRisks);
    base.medication = this.highestRisk(medRisks);

    const riskByCategory: Record<string, RiskLevel[]> = {
      falls: [],
      infection: [],
      nutrition: [],
      deterioration: [],
      other: [],
    };

    for (const item of genericRisks) {
      const category = String((item as any)?.category || '').toLowerCase();
      const risk = String((item as any)?.riskLevel || '').toLowerCase();
      if (risk === 'green' || risk === 'amber' || risk === 'red') {
        allRiskLevels.push(risk);
        if (riskByCategory[category]) {
          riskByCategory[category].push(risk);
        } else {
          riskByCategory.other.push(risk);
        }
      }
    }

    base.mobility = this.highestRisk(riskByCategory.falls);
    base.nutrition = this.highestRisk(riskByCategory.nutrition);
    base.mental_health = this.highestRisk(riskByCategory.deterioration);
    base.safety = this.highestRisk([
      ...riskByCategory.falls,
      ...riskByCategory.infection,
      ...riskByCategory.other,
    ]);
    base.overall = this.highestRisk(allRiskLevels);

    return base;
  }

  private highestRisk(risks: RiskLevel[]): RiskLevel {
    if (risks.includes('red')) return 'red';
    if (risks.includes('amber')) return 'amber';
    return 'green';
  }
}
