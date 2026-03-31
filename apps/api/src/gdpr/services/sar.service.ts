import { BadRequestException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { gzipSync } from 'zlib';
import { PrismaService } from '@oasis/db';

const SAR_REQUEST_PREFIXES = ['sar:', 'sar_'];

export interface SarRequest {
  requestId: string;
  userId: string;
  requestType: string;
  status: string;
  requestedAt: Date;
  completedAt?: Date;
  fileName?: string;
  exportedAt?: Date;
  downloadAvailable: boolean;
  email?: string;
}

export interface UserDataExport {
  profile: {
    client: unknown | null;
    carer: unknown | null;
  };
  visits: unknown[];
  prescriptions: unknown[];
  medicationAdministrations: unknown[];
  shifts: unknown[];
  healthSummaries: unknown[];
  consents: unknown[];
  auditLogs: unknown[];
  exportedAt: Date;
}

export interface SarDownloadArtifact {
  fileName: string;
  contentType: string;
  file: StreamableFile;
}

@Injectable()
export class SarService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueueSubjectAccessRequest(
    userId: string,
    requestType = 'full_record',
    email?: string,
    requestedBy?: string
  ): Promise<SarRequest> {
    const normalizedType = this.toSarRequestType(requestType);
    const existing = await this.prisma.erasureQueue.findFirst({
      where: {
        user_id: userId,
        request_type: normalizedType,
        status: {
          in: ['pending', 'processing'],
        },
      },
      orderBy: {
        requested_at: 'desc',
      },
    });

    if (existing) {
      throw new BadRequestException('A subject access request is already open for this user');
    }

    const request = await this.prisma.erasureQueue.create({
      data: {
        user_id: userId,
        request_type: normalizedType,
        status: 'pending',
        requested_at: new Date(),
        metadata: {
          email: email ?? null,
          requestedBy: requestedBy ?? null,
        },
      },
    });

    return this.mapRequest(request);
  }

  async listSubjectAccessRequests(limit = 20): Promise<SarRequest[]> {
    const requests = await this.prisma.erasureQueue.findMany({
      where: {
        OR: SAR_REQUEST_PREFIXES.map((prefix) => ({
          request_type: {
            startsWith: prefix,
          },
        })),
      },
      orderBy: { requested_at: 'desc' },
      take: limit,
    });

    return requests.map((request) => this.mapRequest(request));
  }

  async getSarStatus(requestId: string): Promise<SarRequest> {
    const request = await this.prisma.erasureQueue.findUnique({
      where: { id: requestId },
    });

    if (!request || !this.isSarRequestType(request.request_type)) {
      throw new NotFoundException('SAR request not found');
    }

    return this.mapRequest(request);
  }

  async processSubjectAccessRequest(requestId: string): Promise<SarRequest> {
    const request = await this.prisma.erasureQueue.findUnique({
      where: { id: requestId },
    });

    if (!request || !this.isSarRequestType(request.request_type)) {
      throw new NotFoundException('SAR request not found');
    }

    await this.prisma.erasureQueue.update({
      where: { id: requestId },
      data: {
        status: 'processing',
      },
    });

    const exportData = await this.generateSubjectAccessReport(request.user_id);
    const fileName = `oasis-sar-${request.user_id}-${new Date().toISOString().slice(0, 10)}.json.gz`;
    const exportBuffer = gzipSync(JSON.stringify(exportData, null, 2));
    const existingMetadata =
      request.metadata && typeof request.metadata === 'object' && !Array.isArray(request.metadata)
        ? (request.metadata as Record<string, unknown>)
        : {};

    const updated = await this.prisma.erasureQueue.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        completed_at: new Date(),
        metadata: {
          ...existingMetadata,
          exportedAt: new Date().toISOString(),
          fileName,
          exportArtifactBase64: exportBuffer.toString('base64'),
          contentType: 'application/gzip',
        },
      },
    });

    return this.mapRequest(updated);
  }

  async downloadSubjectAccessReport(requestId: string): Promise<SarDownloadArtifact> {
    const request = await this.prisma.erasureQueue.findUnique({
      where: { id: requestId },
    });

    if (!request || !this.isSarRequestType(request.request_type)) {
      throw new NotFoundException('SAR request not found');
    }

    const metadata =
      request.metadata && typeof request.metadata === 'object' && !Array.isArray(request.metadata)
        ? (request.metadata as Record<string, unknown>)
        : null;

    const artifactBase64 = typeof metadata?.exportArtifactBase64 === 'string' ? metadata.exportArtifactBase64 : null;
    const fileName = typeof metadata?.fileName === 'string' ? metadata.fileName : `oasis-sar-${request.id}.json.gz`;
    const contentType = typeof metadata?.contentType === 'string' ? metadata.contentType : 'application/gzip';

    if (!artifactBase64) {
      throw new BadRequestException('No export artifact is available for this SAR request');
    }

    return {
      fileName,
      contentType,
      file: new StreamableFile(Buffer.from(artifactBase64, 'base64')),
    };
  }

  async generateSubjectAccessReport(userId: string): Promise<UserDataExport> {
    const [client, carer, visits, prescriptions, medicationAdministrations, healthSummaries, consents, auditLogs] =
      await Promise.all([
        this.prisma.client.findFirst({ where: { id: userId } }),
        this.prisma.carer.findFirst({ where: { id: userId } }),
        this.prisma.visit.findMany({
          where: {
            OR: [{ client_id: userId }, { carer_id: userId }],
          },
          include: {
            tasks: true,
            medication_administrations: true,
          },
          orderBy: { scheduled_start: 'desc' },
        }),
        this.prisma.prescription.findMany({
          where: { client_id: userId },
          include: {
            medication: true,
            administrations: true,
          },
          orderBy: { created_at: 'desc' },
        }),
        this.prisma.medicationAdministration.findMany({
          where: {
            OR: [
              { prescription: { client_id: userId } },
              { administered_by: userId },
              { visit: { carer_id: userId } },
            ],
          },
          include: {
            prescription: {
              include: {
                medication: true,
              },
            },
            visit: true,
          },
          orderBy: { scheduled_time: 'desc' },
        }),
        this.prisma.healthSummary.findMany({
          where: {
            OR: [{ client_id: userId }, { approved_by: userId }],
          },
          orderBy: { generated_at: 'desc' },
        }),
        this.prisma.consentRecord.findMany({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
        }),
        this.prisma.auditLog.findMany({
          where: { user_id: userId },
          orderBy: { timestamp: 'desc' },
          take: 1000,
        }),
      ]);

    return {
      profile: {
        client: client ? this.sanitizeClient(client) : null,
        carer: carer ? this.sanitizeCarer(carer) : null,
      },
      visits: visits.map((visit: any) => this.sanitizeVisit(visit)),
      prescriptions: prescriptions.map((prescription: any) => this.sanitizePrescription(prescription)),
      medicationAdministrations: medicationAdministrations.map((administration: any) =>
        this.sanitizeAdministration(administration)
      ),
      shifts: [],
      healthSummaries: healthSummaries.map((summary: any) => this.sanitizeHealthSummary(summary)),
      consents: consents.map((consent: any) => this.sanitizeConsent(consent)),
      auditLogs: auditLogs.map((log: any) => this.sanitizeAuditLog(log)),
      exportedAt: new Date(),
    };
  }

  private mapRequest(request: {
    id: string;
    user_id: string;
    request_type: string;
    status: string;
    requested_at: Date;
    completed_at: Date | null;
    metadata: unknown;
  }): SarRequest {
    const metadata =
      request.metadata && typeof request.metadata === 'object' && !Array.isArray(request.metadata)
        ? (request.metadata as Record<string, unknown>)
        : {};

    return {
      requestId: request.id,
      userId: request.user_id,
      requestType: this.fromSarRequestType(request.request_type),
      status: request.status,
      requestedAt: request.requested_at,
      completedAt: request.completed_at ?? undefined,
      fileName: typeof metadata.fileName === 'string' ? metadata.fileName : undefined,
      exportedAt:
        typeof metadata.exportedAt === 'string' ? new Date(metadata.exportedAt) : undefined,
      downloadAvailable: typeof metadata.exportArtifactBase64 === 'string',
      email: typeof metadata.email === 'string' ? metadata.email : undefined,
    };
  }

  private isSarRequestType(requestType: string): boolean {
    return SAR_REQUEST_PREFIXES.some((prefix) => requestType.startsWith(prefix));
  }

  private toSarRequestType(requestType: string): string {
    return requestType.startsWith('sar:') ? requestType : `sar:${requestType}`;
  }

  private fromSarRequestType(requestType: string): string {
    return requestType.replace(/^sar[:_]/, '');
  }

  private sanitizeClient(client: Record<string, unknown>) {
    return {
      id: client.id,
      fullName: client.full_name,
      addressLine1: client.address_line1,
      addressLine2: client.address_line2,
      city: client.city,
      postcode: client.postcode,
      dateOfBirth: client.date_of_birth,
      createdAt: client.created_at,
      updatedAt: client.updated_at,
      deletedAt: client.deleted_at,
    };
  }

  private sanitizeCarer(carer: Record<string, unknown>) {
    return {
      id: carer.id,
      firstName: carer.first_name,
      lastName: carer.last_name,
      email: carer.email,
      phone: carer.phone,
      hireDate: carer.hire_date,
      isActive: carer.is_active,
      createdAt: carer.created_at,
      updatedAt: carer.updated_at,
      deletedAt: carer.deleted_at,
    };
  }

  private sanitizeVisit(visit: Record<string, any>) {
    return {
      id: visit.id,
      clientId: visit.client_id,
      carerId: visit.carer_id,
      scheduledStart: visit.scheduled_start,
      scheduledEnd: visit.scheduled_end,
      actualStart: visit.actual_start,
      actualEnd: visit.actual_end,
      status: visit.status,
      notes: visit.notes,
      tasks: Array.isArray(visit.tasks)
        ? visit.tasks.map((task: Record<string, any>) => ({
            id: task.id,
            taskName: task.task_name,
            description: task.description,
            isCompleted: task.is_completed,
            completedAt: task.completed_at,
            notes: task.notes,
          }))
        : [],
      medicationAdministrations: Array.isArray(visit.medication_administrations)
        ? visit.medication_administrations.map((administration: Record<string, any>) => ({
            id: administration.id,
            scheduledTime: administration.scheduled_time,
            administeredTime: administration.administered_time,
            status: administration.status,
            notes: administration.notes,
            instructionSnapshot: administration.instruction_snapshot,
          }))
        : [],
      createdAt: visit.created_at,
      updatedAt: visit.updated_at,
      deletedAt: visit.deleted_at,
    };
  }

  private sanitizePrescription(prescription: Record<string, any>) {
    return {
      id: prescription.id,
      clientId: prescription.client_id,
      medicationId: prescription.medication_id,
      startDate: prescription.start_date,
      endDate: prescription.end_date,
      frequencyPerDay: prescription.frequency_per_day,
      frequencyIntervalHours: prescription.frequency_interval_hours,
      administrationTimes: prescription.administration_times,
      specialInstructions: prescription.special_instructions,
      isActive: prescription.is_active,
      medication: prescription.medication
        ? {
            id: prescription.medication.id,
            name: prescription.medication.name,
            dosage: prescription.medication.dosage,
            unit: prescription.medication.unit,
            instructions: prescription.medication.instructions,
          }
        : null,
      administrations: Array.isArray(prescription.administrations)
        ? prescription.administrations.map((administration: Record<string, any>) =>
            this.sanitizeAdministration(administration)
          )
        : [],
      createdAt: prescription.created_at,
      updatedAt: prescription.updated_at,
      deletedAt: prescription.deleted_at,
    };
  }

  private sanitizeAdministration(administration: Record<string, any>) {
    return {
      id: administration.id,
      prescriptionId: administration.prescription_id,
      visitId: administration.visit_id,
      scheduledTime: administration.scheduled_time,
      administeredTime: administration.administered_time,
      administeredBy: administration.administered_by,
      status: administration.status,
      notes: administration.notes,
      instructionSnapshot: administration.instruction_snapshot,
      createdAt: administration.created_at,
      updatedAt: administration.updated_at,
      deletedAt: administration.deleted_at,
    };
  }

  private sanitizeHealthSummary(summary: Record<string, any>) {
    return {
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
      createdAt: summary.created_at,
      updatedAt: summary.updated_at,
    };
  }

  private sanitizeConsent(consent: Record<string, any>) {
    return {
      id: consent.id,
      userId: consent.user_id,
      consentType: consent.consent_type,
      purpose: consent.purpose,
      granted: consent.granted,
      grantedAt: consent.granted_at,
      withdrawnAt: consent.withdrawn_at,
      legalBasis: consent.legal_basis,
      metadata: consent.metadata,
      createdAt: consent.created_at,
      updatedAt: consent.updated_at,
    };
  }

  private sanitizeAuditLog(log: Record<string, any>) {
    return {
      id: log.id,
      action: log.action,
      resourceType: log.resource_type,
      resourceId: log.resource_id,
      oldValues: log.old_values,
      newValues: log.new_values,
      timestamp: log.timestamp,
    };
  }
}
