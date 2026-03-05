import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@oasis/db';

export interface ErasureRequest {
  requestId: string;
  userId: string;
  requestType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  scheduledFor: Date | null;
  completedAt?: Date;
}

export interface ErasureResult {
  success: boolean;
  erasedRecords: {
    visits: number;
    medications: number;
    healthSummaries: number;
    consents: number;
    auditLogs: number;
    embeddings: number;
  };
  pseudonymizedRecords: {
    profile: boolean;
  };
  completedAt: Date;
}

@Injectable()
export class ErasureService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enqueue a data erasure request
   */
  async enqueueDataErasure(
    userId: string,
    requestType: string,
    reason?: string,
  ): Promise<ErasureRequest> {
    // Check if there's already a pending request
    const existing = await this.prisma.erasureQueue.findFirst({
      where: {
        user_id: userId,
        request_type: requestType,
        status: 'pending',
      },
    });

    if (existing) {
      throw new BadRequestException('An erasure request is already pending for this user');
    }

    // Schedule for 30 days from now (GDPR allows up to 30 days)
    const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const request = await this.prisma.erasureQueue.create({
      data: {
        user_id: userId,
        request_type: requestType,
        status: 'pending',
        requested_at: new Date(),
        scheduled_for: scheduledFor,
      },
    });

    return {
      requestId: request.id,
      userId: request.user_id,
      requestType: request.request_type,
      status: 'pending',
      requestedAt: request.requested_at,
      scheduledFor: request.scheduled_for,
    };
  }

  /**
   * Process data erasure for a user
   * This should be called by a scheduled job, not directly
   */
  async processDataErasure(requestId: string): Promise<ErasureResult> {
    const request = await this.prisma.erasureQueue.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Erasure request not found');
    }

    const userId = request.user_id;
    const erasedRecords = {
      visits: 0,
      medications: 0,
      healthSummaries: 0,
      consents: 0,
      auditLogs: 0,
      embeddings: 0,
    };

    // Use a transaction to ensure atomicity
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete visit tasks first (foreign key constraint)
      const visits = await tx.visit.findMany({
        where: { OR: [{ client_id: userId }, { carer_id: userId }] },
        select: { id: true },
      });
      
      for (const visit of visits) {
        await tx.visitTask.deleteMany({ where: { visit_id: visit.id } });
      }

      // 2. Soft delete visits (keep for audit but anonymize)
      const visitResult = await tx.visit.updateMany({
        where: { OR: [{ client_id: userId }, { carer_id: userId }] },
        data: {
          notes: '[REDACTED]',
          deleted_at: new Date(),
        },
      });
      erasedRecords.visits = visitResult.count;

      // 3. Delete prescriptions (medications are linked via prescriptions)
      const medResult = await tx.prescription.deleteMany({
        where: { client_id: userId },
      });
      erasedRecords.medications = medResult.count;

      // 4. Delete health summaries
      const summaryResult = await tx.healthSummary.deleteMany({
        where: { client_id: userId },
      });
      erasedRecords.healthSummaries = summaryResult.count;

      // 5. Delete consent records (keeping for compliance)
      // Actually we should keep consent records for legal compliance
      // Just mark them as related to deleted user
      const consentResult = await tx.consentRecord.updateMany({
        where: { user_id: userId },
        data: {
          metadata: { erasureRequestId: requestId, erasedAt: new Date().toISOString() },
        },
      });
      erasedRecords.consents = consentResult.count;

      // 6. Anonymize audit logs (keep for compliance but remove PII)
      const auditResult = await tx.auditLog.updateMany({
        where: { user_id: userId },
        data: {
          user_id: 'ANONYMIZED',
          ip_address: null,
          user_agent: null,
        },
      });
      erasedRecords.auditLogs = auditResult.count;

      // 7. Delete embeddings
      const embeddingResult = await tx.logEmbedding.deleteMany({
        where: { visit: { OR: [{ client_id: userId }, { carer_id: userId }] } },
      });
      erasedRecords.embeddings = embeddingResult.count;

      // 8. Pseudonymize the user profile
      const client = await tx.client.findFirst({ where: { id: userId } });
      if (client) {
        await tx.client.update({
          where: { id: userId },
          data: {
            full_name: 'DELETED USER',
            date_of_birth: new Date('1900-01-01'),
            address_line1: '[REDACTED]',
            address_line2: null,
            city: '[REDACTED]',
            postcode: '[REDACTED]',
            deleted_at: new Date(),
          },
        });
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
            deleted_at: new Date(),
          },
        });
      }

      // 9. Mark the erasure request as completed
      await tx.erasureQueue.update({
        where: { id: requestId },
        data: {
          status: 'completed',
          completed_at: new Date(),
        },
      });
    });

    return {
      success: true,
      erasedRecords,
      pseudonymizedRecords: {
        profile: true,
      },
      completedAt: new Date(),
    };
  }

  /**
   * Get erasure request status
   */
  async getErasureStatus(requestId: string): Promise<ErasureRequest> {
    const request = await this.prisma.erasureQueue.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Erasure request not found');
    }

    return {
      requestId: request.id,
      userId: request.user_id,
      requestType: request.request_type,
      status: request.status as ErasureRequest['status'],
      requestedAt: request.requested_at,
      scheduledFor: request.scheduled_for,
      completedAt: request.completed_at || undefined,
    };
  }

  /**
   * Cancel an erasure request (only if still pending)
   */
  async cancelErasureRequest(requestId: string): Promise<void> {
    const request = await this.prisma.erasureQueue.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Erasure request not found');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Can only cancel pending erasure requests');
    }

    await this.prisma.erasureQueue.update({
      where: { id: requestId },
      data: { status: 'cancelled' as any },
    });
  }
}
