import { Injectable } from '@nestjs/common';
import { PrismaService } from '@oasis/db';

export interface RetentionEnforcementResult {
  category: string;
  action: 'delete' | 'scrub' | 'skip';
  affected: number;
}

@Injectable()
export class RetentionService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaultPolicies = [
    {
      data_category: 'audit_log',
      retention_days: 365,
      legal_basis: 'Operational oversight and accountability',
      description: 'Retain masked audit logs long enough for service review and buyer-proof auditability.',
    },
    {
      data_category: 'gdpr_request_artifact',
      retention_days: 30,
      legal_basis: 'Data subject rights handling',
      description: 'Keep SAR and erasure request artifacts briefly, then purge the export payloads from stored metadata.',
    },
    {
      data_category: 'log_embedding',
      retention_days: 30,
      legal_basis: 'Derived operational support data',
      description: 'Remove derived embedding data on a short retention window once it is no longer operationally useful.',
    },
  ] as const

  private async ensureDefaultPolicies() {
    const activePolicies = await this.prisma.retentionPolicy.findMany({
      where: { is_active: true },
      select: { data_category: true },
    })

    const activeCategories = new Set(activePolicies.map((policy) => policy.data_category))
    const missingPolicies = this.defaultPolicies.filter((policy) => !activeCategories.has(policy.data_category))

    if (!missingPolicies.length) {
      return
    }

    await this.prisma.$transaction(
      missingPolicies.map((policy) =>
        this.prisma.retentionPolicy.create({
          data: policy,
        })
      )
    )
  }

  async listPolicies() {
    await this.ensureDefaultPolicies()

    return this.prisma.retentionPolicy.findMany({
      where: { is_active: true },
      orderBy: [{ data_category: 'asc' }],
    });
  }

  async enforcePolicies(referenceTime = new Date()): Promise<RetentionEnforcementResult[]> {
    const policies = await this.listPolicies();
    const results: RetentionEnforcementResult[] = [];

    for (const policy of policies) {
      const cutoff = new Date(referenceTime.getTime() - policy.retention_days * 24 * 60 * 60 * 1000);

      if (policy.data_category === 'audit_log') {
        const deleted = await this.prisma.auditLog.deleteMany({
          where: {
            timestamp: {
              lt: cutoff,
            },
          },
        });
        results.push({ category: policy.data_category, action: 'delete', affected: deleted.count });
        continue;
      }

      if (policy.data_category === 'log_embedding') {
        const deleted = await this.prisma.logEmbedding.deleteMany({
          where: {
            created_at: {
              lt: cutoff,
            },
          },
        });
        results.push({ category: policy.data_category, action: 'delete', affected: deleted.count });
        continue;
      }

      if (policy.data_category === 'gdpr_request_artifact') {
        const requests = await this.prisma.erasureQueue.findMany({
          where: {
            completed_at: {
              lt: cutoff,
            },
          },
          select: {
            id: true,
            metadata: true,
          },
        });

        let scrubbed = 0;
        for (const request of requests) {
          if (!request.metadata || typeof request.metadata !== 'object' || Array.isArray(request.metadata)) {
            continue;
          }

          const nextMetadata = { ...(request.metadata as Record<string, unknown>) };
          const hadArtifact =
            'exportArtifactBase64' in nextMetadata ||
            'fileName' in nextMetadata ||
            'downloadUrl' in nextMetadata ||
            'exportedAt' in nextMetadata;

          delete nextMetadata.exportArtifactBase64;
          delete nextMetadata.fileName;
          delete nextMetadata.downloadUrl;
          delete nextMetadata.exportedAt;

          if (!hadArtifact) {
            continue;
          }

          nextMetadata.artifactPurgedAt = referenceTime.toISOString();

          await this.prisma.erasureQueue.update({
            where: { id: request.id },
            data: {
              metadata: nextMetadata as any,
            },
          });
          scrubbed += 1;
        }

        results.push({ category: policy.data_category, action: 'scrub', affected: scrubbed });
        continue;
      }

      results.push({ category: policy.data_category, action: 'skip', affected: 0 });
    }

    return results;
  }
}
