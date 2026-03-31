import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@oasis/db';

const ERASURE_REQUEST_PREFIX = 'erasure:';

export interface ErasureRequest {
  requestId: string;
  userId: string;
  requestType: string;
  status: string;
  requestedAt: Date;
  scheduledFor: Date | null;
  completedAt?: Date;
  reason?: string;
  result?: ErasureResult;
}

export interface ErasureResult {
  success: boolean;
  categoryResults: {
    futureVisitsCancelled: number;
    visitNotesRedacted: number;
    visitTasksRedacted: number;
    prescriptionsDeactivated: number;
    futureAdministrationsCancelled: number;
    healthSummariesDeleted: number;
    consentRecordsAnnotated: number;
    auditLogsAnonymized: number;
    embeddingsDeleted: number;
    shiftsRedacted: number;
  };
  pseudonymizedProfiles: {
    client: boolean;
    carer: boolean;
  };
  completedAt: Date;
}

@Injectable()
export class ErasureService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueueDataErasure(
    userId: string,
    requestType = 'data_subject_request',
    reason?: string,
    requestedBy?: string
  ): Promise<ErasureRequest> {
    const normalizedType = this.toErasureRequestType(requestType);
    const existing = await this.prisma.erasureQueue.findFirst({
      where: {
        user_id: userId,
        request_type: normalizedType,
        status: {
          in: ['pending', 'processing'],
        },
      },
      orderBy: { requested_at: 'desc' },
    });

    if (existing) {
      throw new BadRequestException('An erasure request is already open for this user');
    }

    const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const request = await this.prisma.erasureQueue.create({
      data: {
        user_id: userId,
        request_type: normalizedType,
        status: 'pending',
        requested_at: new Date(),
        scheduled_for: scheduledFor,
        metadata: {
          requestedBy: requestedBy ?? null,
          reason: reason ?? null,
        },
      },
    });

    return this.mapRequest(request);
  }

  async listErasureRequests(limit = 20): Promise<ErasureRequest[]> {
    const requests = await this.prisma.erasureQueue.findMany({
      where: {
        request_type: {
          startsWith: ERASURE_REQUEST_PREFIX,
        },
      },
      orderBy: { requested_at: 'desc' },
      take: limit,
    });

    return requests.map((request) => this.mapRequest(request));
  }

  async processDataErasure(requestId: string): Promise<ErasureResult> {
    const request = await this.prisma.erasureQueue.findUnique({
      where: { id: requestId },
    });

    if (!request || !request.request_type.startsWith(ERASURE_REQUEST_PREFIX)) {
      throw new NotFoundException('Erasure request not found');
    }

    await this.prisma.erasureQueue.update({
      where: { id: requestId },
      data: {
        status: 'processing',
      },
    });

    const now = new Date();
    const userId = request.user_id;
    const categoryResults: ErasureResult['categoryResults'] = {
      futureVisitsCancelled: 0,
      visitNotesRedacted: 0,
      visitTasksRedacted: 0,
      prescriptionsDeactivated: 0,
      futureAdministrationsCancelled: 0,
      healthSummariesDeleted: 0,
      consentRecordsAnnotated: 0,
      auditLogsAnonymized: 0,
      embeddingsDeleted: 0,
      shiftsRedacted: 0,
    };
    let pseudonymizedClient = false;
    let pseudonymizedCarer = false;

    await this.prisma.$transaction(async (tx) => {
      const relatedVisits = await tx.visit.findMany({
        where: {
          OR: [{ client_id: userId }, { carer_id: userId }],
        },
        select: {
          id: true,
          scheduled_start: true,
        },
      });

      const futureVisitIds = relatedVisits
        .filter((visit) => visit.scheduled_start >= now)
        .map((visit) => visit.id);
      const retainedVisitIds = relatedVisits.map((visit) => visit.id);

      if (futureVisitIds.length > 0) {
        const futureVisits = await tx.visit.updateMany({
          where: {
            id: { in: futureVisitIds },
          },
          data: {
            status: 'CANCELLED',
            notes: null,
            deleted_at: now,
          },
        });
        categoryResults.futureVisitsCancelled = futureVisits.count;
      }

      if (retainedVisitIds.length > 0) {
        const noteRedaction = await tx.visit.updateMany({
          where: {
            id: { in: retainedVisitIds },
            notes: { not: null },
          },
          data: {
            notes: '[REDACTED]',
          },
        });
        categoryResults.visitNotesRedacted = noteRedaction.count;

        const taskRedaction = await tx.visitTask.updateMany({
          where: {
            visit_id: { in: retainedVisitIds },
            OR: [{ description: { not: null } }, { notes: { not: null } }],
          },
          data: {
            description: '[REDACTED]',
            notes: '[REDACTED]',
          },
        });
        categoryResults.visitTasksRedacted = taskRedaction.count;

        const embeddingsDeleted = await tx.logEmbedding.deleteMany({
          where: {
            visit_id: { in: retainedVisitIds },
          },
        });
        categoryResults.embeddingsDeleted = embeddingsDeleted.count;
      }

      const prescriptions = await tx.prescription.findMany({
        where: { client_id: userId },
        select: { id: true },
      });
      const prescriptionIds = prescriptions.map((prescription) => prescription.id);

      if (prescriptionIds.length > 0) {
        const deactivated = await tx.prescription.updateMany({
          where: { id: { in: prescriptionIds } },
          data: {
            is_active: false,
            end_date: now,
            special_instructions: '[REDACTED]',
          },
        });
        categoryResults.prescriptionsDeactivated = deactivated.count;

        const futureAdministrations = await tx.medicationAdministration.updateMany({
          where: {
            prescription_id: { in: prescriptionIds },
            status: 'SCHEDULED',
            scheduled_time: {
              gte: now,
            },
          },
          data: {
            status: 'CANCELLED',
            notes: null,
          },
        });
        categoryResults.futureAdministrationsCancelled = futureAdministrations.count;
      }

      const summariesDeleted = await tx.healthSummary.deleteMany({
        where: {
          client_id: userId,
        },
      });
      categoryResults.healthSummariesDeleted = summariesDeleted.count;

      const consentsAnnotated = await tx.consentRecord.updateMany({
        where: { user_id: userId },
        data: {
          metadata: {
            erasureRequestId: requestId,
            erasedAt: now.toISOString(),
          },
        },
      });
      categoryResults.consentRecordsAnnotated = consentsAnnotated.count;

      const auditsAnonymized = await tx.auditLog.updateMany({
        where: { user_id: userId },
        data: {
          user_id: 'ANONYMIZED',
          ip_address: null,
          user_agent: null,
        },
      });
      categoryResults.auditLogsAnonymized = auditsAnonymized.count;

      const client = await tx.client.findFirst({ where: { id: userId } });
      if (client) {
        await tx.client.update({
          where: { id: userId },
          data: {
            full_name: 'DELETED CLIENT',
            date_of_birth: null,
            address_line1: '[REDACTED]',
            address_line2: null,
            city: '[REDACTED]',
            postcode: '[REDACTED]',
            deleted_at: now,
          },
        });
        pseudonymizedClient = true;
      }

      const carer = await tx.carer.findFirst({ where: { id: userId } });
      if (carer) {
        await tx.carer.update({
          where: { id: userId },
          data: {
            first_name: 'DELETED',
            last_name: 'USER',
            email: `deleted-${userId}@anonymized.local`,
            phone: null,
            is_active: false,
            deleted_at: now,
          },
        });
        pseudonymizedCarer = true;
      }

      const result: ErasureResult = {
        success: true,
        categoryResults,
        pseudonymizedProfiles: {
          client: pseudonymizedClient,
          carer: pseudonymizedCarer,
        },
        completedAt: now,
      };

      const existingMetadata =
        request.metadata && typeof request.metadata === 'object' && !Array.isArray(request.metadata)
          ? (request.metadata as Record<string, unknown>)
          : {};

      await tx.erasureQueue.update({
        where: { id: requestId },
        data: {
          status: 'completed',
          completed_at: now,
          metadata: {
            ...existingMetadata,
            completedAt: now.toISOString(),
            result,
          } as any,
        },
      });
    });

    return {
      success: true,
      categoryResults,
      pseudonymizedProfiles: {
        client: pseudonymizedClient,
        carer: pseudonymizedCarer,
      },
      completedAt: now,
    };
  }

  async getErasureStatus(requestId: string): Promise<ErasureRequest> {
    const request = await this.prisma.erasureQueue.findUnique({
      where: { id: requestId },
    });

    if (!request || !request.request_type.startsWith(ERASURE_REQUEST_PREFIX)) {
      throw new NotFoundException('Erasure request not found');
    }

    return this.mapRequest(request);
  }

  async cancelErasureRequest(requestId: string): Promise<void> {
    const request = await this.prisma.erasureQueue.findUnique({
      where: { id: requestId },
    });

    if (!request || !request.request_type.startsWith(ERASURE_REQUEST_PREFIX)) {
      throw new NotFoundException('Erasure request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Can only cancel pending erasure requests');
    }

    await this.prisma.erasureQueue.update({
      where: { id: requestId },
      data: { status: 'cancelled' },
    });
  }

  private toErasureRequestType(requestType: string): string {
    return requestType.startsWith(ERASURE_REQUEST_PREFIX)
      ? requestType
      : `${ERASURE_REQUEST_PREFIX}${requestType}`;
  }

  private fromErasureRequestType(requestType: string): string {
    return requestType.replace(/^erasure:/, '');
  }

  private mapRequest(request: {
    id: string;
    user_id: string;
    request_type: string;
    status: string;
    requested_at: Date;
    scheduled_for: Date | null;
    completed_at: Date | null;
    metadata: unknown;
  }): ErasureRequest {
    const metadata =
      request.metadata && typeof request.metadata === 'object' && !Array.isArray(request.metadata)
        ? (request.metadata as Record<string, unknown>)
        : {};

    return {
      requestId: request.id,
      userId: request.user_id,
      requestType: this.fromErasureRequestType(request.request_type),
      status: request.status,
      requestedAt: request.requested_at,
      scheduledFor: request.scheduled_for,
      completedAt: request.completed_at ?? undefined,
      reason: typeof metadata.reason === 'string' ? metadata.reason : undefined,
      result:
        metadata.result && typeof metadata.result === 'object' && !Array.isArray(metadata.result)
          ? (metadata.result as ErasureResult)
          : undefined,
    };
  }
}
