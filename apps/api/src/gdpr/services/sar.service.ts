import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@oasis/db';

export interface SarRequest {
  requestId: string;
  userId: string;
  requestType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
}

export interface UserDataExport {
  profile: any;
  visits: any[];
  medications: any[];
  healthSummaries: any[];
  consents: any[];
  auditLogs: any[];
  exportedAt: Date;
}

@Injectable()
export class SarService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enqueue a Subject Access Request
   */
  async enqueueSubjectAccessRequest(
    organizationId: string,
    userId: string,
    requestType: string,
    email?: string,
  ): Promise<SarRequest> {
    // Create an erasure queue entry for tracking (reusing the model)
    const request = await this.prisma.erasureQueue.create({
      data: {
        organization_id: organizationId,
        user_id: userId,
        request_type: `sar_${requestType}`,
        status: 'pending',
        requested_at: new Date(),
        scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    return {
      requestId: request.id,
      userId: request.user_id,
      requestType,
      status: 'pending',
      requestedAt: request.requested_at,
    };
  }

  /**
   * Generate a Subject Access Report with all user data
   */
  async generateSubjectAccessReport(organizationId: string, userId: string): Promise<UserDataExport> {
    // Gather all user data across tables
    const [
      client,
      carer,
      visits,
      prescriptions,
      healthSummaries,
      consents,
      auditLogs,
    ] = await Promise.all([
      // Try to find as client
      this.prisma.client.findFirst({ where: { id: userId, organization_id: organizationId } }),
      // Try to find as carer
      this.prisma.carer.findFirst({ where: { id: userId, organization_id: organizationId } }),
      // Get visits (as client or carer)
      this.prisma.visit.findMany({
        where: {
          organization_id: organizationId,
          OR: [
            { client_id: userId },
            { carer_id: userId },
          ],
        },
        include: {
          tasks: true,
        },
      }),
      // Get prescriptions (medications linked via prescriptions)
      this.prisma.prescription.findMany({
        where: { client_id: userId, client: { organization_id: organizationId } },
        include: { medication: true },
      }),
      // Get health summaries (if client)
      this.prisma.healthSummary.findMany({
        where: { client_id: userId, client: { organization_id: organizationId } },
      }),
      // Get consent records
      this.prisma.consentRecord.findMany({
        where: { organization_id: organizationId, user_id: userId },
      }),
      // Get audit logs
      this.prisma.auditLog.findMany({
        where: { organization_id: organizationId, user_id: userId },
        take: 1000, // Limit to last 1000 entries
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    // Build profile from client or carer data
    const profile = client || carer || null;

    return {
      profile: profile ? this.sanitizeProfile(profile) : null,
      visits: visits.map(this.sanitizeVisit),
      medications: prescriptions.map(this.sanitizePrescription),
      healthSummaries: healthSummaries.map(this.sanitizeHealthSummary),
      consents: consents.map(this.sanitizeConsent),
      auditLogs: auditLogs.map(this.sanitizeAuditLog),
      exportedAt: new Date(),
    };
  }

  /**
   * Get the status of a SAR request
   */
  async getSarStatus(organizationId: string, requestId: string): Promise<SarRequest> {
    const request = await this.prisma.erasureQueue.findFirst({
      where: { id: requestId, organization_id: organizationId },
    });

    if (!request || !request.request_type.startsWith('sar_')) {
      throw new NotFoundException('SAR request not found');
    }

    return {
      requestId: request.id,
      userId: request.user_id,
      requestType: request.request_type.replace('sar_', ''),
      status: request.status as SarRequest['status'],
      requestedAt: request.requested_at,
      completedAt: request.completed_at || undefined,
    };
  }

  // Sanitization helpers to remove sensitive internal fields
  private sanitizeProfile(profile: any): any {
    const { id, created_at, updated_at, ...rest } = profile;
    return {
      id,
      ...rest,
      createdAt: created_at,
      updatedAt: updated_at,
    };
  }

  private sanitizeVisit(visit: any): any {
    return {
      id: visit.id,
      scheduledAt: visit.scheduled_at,
      startedAt: visit.started_at,
      endedAt: visit.ended_at,
      status: visit.status,
      notes: visit.notes,
      tasks: visit.tasks?.map((t: any) => ({
        id: t.id,
        name: t.name,
        completed: t.completed,
        completedAt: t.completed_at,
      })),
    };
  }

  private sanitizePrescription(prescription: any): any {
    return {
      id: prescription.id,
      medicationName: prescription.medication?.name,
      dosage: prescription.medication?.dosage,
      unit: prescription.medication?.unit,
      instructions: prescription.special_instructions,
      frequencyPerDay: prescription.frequency_per_day,
      startDate: prescription.start_date,
      endDate: prescription.end_date,
      isActive: prescription.is_active,
    };
  }

  private sanitizeHealthSummary(summary: any): any {
    return {
      id: summary.id,
      periodStart: summary.period_start,
      periodEnd: summary.period_end,
      summaryText: summary.summary_text,
      riskLevel: summary.risk_level,
      approved: summary.approved,
      approvedAt: summary.approved_at,
    };
  }

  private sanitizeConsent(consent: any): any {
    return {
      id: consent.id,
      consentType: consent.consent_type,
      purpose: consent.purpose,
      granted: consent.granted,
      grantedAt: consent.granted_at,
      withdrawnAt: consent.withdrawn_at,
      legalBasis: consent.legal_basis,
    };
  }

  private sanitizeAuditLog(log: any): any {
    return {
      id: log.id,
      action: log.action,
      resourceType: log.resource_type,
      resourceId: log.resource_id,
      timestamp: log.timestamp,
      // Exclude IP address and user agent for privacy
    };
  }
}
