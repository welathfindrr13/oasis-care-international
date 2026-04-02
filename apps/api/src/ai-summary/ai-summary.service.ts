import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { AiSummaryRepository } from './ai-summary.repository';
import { MedicationRepository } from '../medication/medication.repository';
import { GenerateSummaryInput } from './dto/generate-summary.input';
import { ApproveSummaryInput } from './dto/approve-summary.input';
import { HealthSummaryFilterArgs } from './dto/health-summary-filter.args';
import { HealthSummary, MedicationAuditAction } from '@oasis/db';
import { ClsService } from 'nestjs-cls';
import { BaseHttpException } from '../common/errors/base-http.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { EmbeddingBatchService } from './embeddings/embedding.batch';

@Injectable()
export class AiSummaryService {
  private readonly logger = new Logger(AiSummaryService.name);

  constructor(
    private readonly aiSummaryRepository: AiSummaryRepository,
    private readonly medicationRepository: MedicationRepository,
    private readonly embeddingBatchService: EmbeddingBatchService,
    private readonly cls: ClsService,
  ) {}

  async generateSummary(
    data: GenerateSummaryInput,
    userId: string,
    userRole: string
  ): Promise<HealthSummary> {
    const requestId = this.cls.get('requestId');
    this.logger.log(`Generating AI summary for client ${data.clientId}`, { requestId });

    if (process.env.AI_SUMMARY_ENABLED_ENV !== 'true') {
      throw new BaseHttpException(
        ErrorCode.FEATURE_NOT_ENABLED,
        'AI summary generation is currently disabled in this environment',
        HttpStatus.FORBIDDEN
      );
    }

    // Check if AI summary is enabled for this client's organization
    const aiEnabled = await this.aiSummaryRepository.checkOrganizationAIEnabled(data.clientId);
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
      new Date(data.periodEnd)
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

    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart >= periodEnd) {
      throw new BaseHttpException(
        ErrorCode.VALIDATION_FAILED,
        'Summary period must include a valid start date before the end date',
        HttpStatus.BAD_REQUEST
      );
    }

    let summaryPayload: {
      summaryJson: any;
      riskLevels: any;
      careLogCount: number;
    };

    try {
      summaryPayload = await this.embeddingBatchService.generateSummaryPayload(
        data.clientId,
        periodStart,
        periodEnd
      );
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Unable to generate AI summary right now';
      const statusCode = /No care activity/i.test(message)
        ? HttpStatus.UNPROCESSABLE_ENTITY
        : HttpStatus.BAD_GATEWAY;

      throw new BaseHttpException(
        statusCode === HttpStatus.UNPROCESSABLE_ENTITY ? ErrorCode.VALIDATION_FAILED : ErrorCode.INTERNAL_ERROR,
        message,
        statusCode
      );
    }

    const summary = await this.aiSummaryRepository.create({
      client: { connect: { id: data.clientId } },
      period_start: periodStart,
      period_end: periodEnd,
      summary_json: summaryPayload.summaryJson,
      risk_levels: summaryPayload.riskLevels,
      generated_at: new Date(),
      generated_by: 'ai',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Audit: Log AI summary generation
    await this.medicationRepository.createMedicationAudit({
      action: MedicationAuditAction.AI_SUMMARY_GENERATED,
      actorId: userId,
      actorRole: userRole,
      changes: {
        summaryId: summary.id,
        clientId: data.clientId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        riskLevels: summaryPayload.riskLevels,
        careLogCount: summaryPayload.careLogCount,
      },
    });

    this.logger.log(`AI summary ${summary.id} generated successfully`, { requestId });
    return summary;
  }

  async listPendingSummaries(
    skip?: number,
    take?: number,
    userId?: string,
    userRole?: string
  ): Promise<{ items: HealthSummary[]; total: number }> {
    const requestId = this.cls.get('requestId');
    
    // Only admins can review pending summaries in the current UI.
    if (userRole !== 'admin') {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ROLE_REQUIRED,
        'Only admins can view pending summaries',
        HttpStatus.FORBIDDEN
      );
    }

    this.logger.log(`Listing pending AI summaries`, { requestId, userRole });
    
    return this.aiSummaryRepository.findPending({ skip, take });
  }

  async listHistory(
    filter: HealthSummaryFilterArgs,
    userId: string,
    userRole: string
  ): Promise<{ items: HealthSummary[]; total: number }> {
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
    });
  }

  async approveSummary(
    data: ApproveSummaryInput,
    userId: string,
    userRole: string
  ): Promise<HealthSummary> {
    const requestId = this.cls.get('requestId');
    
    // Only admins can approve summaries in the current UI.
    if (userRole !== 'admin') {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_ROLE_REQUIRED,
        'Only admins can approve summaries',
        HttpStatus.FORBIDDEN
      );
    }

    const summary = await this.aiSummaryRepository.findById(data.summaryId);
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
    const aiEnabled = await this.aiSummaryRepository.checkOrganizationAIEnabled(summary.client_id);
    if (!aiEnabled) {
      throw new BaseHttpException(
        ErrorCode.FEATURE_NOT_ENABLED,
        'AI summary feature is not enabled for this organization',
        HttpStatus.FORBIDDEN
      );
    }

    this.logger.log(`Approving summary ${data.summaryId}`, { 
      requestId, 
      feedback: data.feedback,
      approverId: userId 
    });

    const approvedSummary = await this.aiSummaryRepository.approve(data.summaryId, userId, data.feedback);

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

  async getCurrentWeekSummary(
    clientId: string,
    userId: string,
    userRole: string
  ): Promise<HealthSummary | null> {
    // Check access permissions
    if (userRole === 'client' && clientId !== userId) {
      throw new BaseHttpException(
        ErrorCode.FORBIDDEN_OWN_RESOURCE_ONLY,
        'You can only view your own summaries',
        HttpStatus.FORBIDDEN
      );
    }

    // Check if AI is enabled
    const aiEnabled = await this.aiSummaryRepository.checkOrganizationAIEnabled(clientId);
    if (!aiEnabled) {
      return null;
    }

    return this.aiSummaryRepository.findCurrentWeekSummary(clientId);
  }

  private isSummaryExpired(summary: HealthSummary): boolean {
    return new Date() > summary.expires_at;
  }
}
