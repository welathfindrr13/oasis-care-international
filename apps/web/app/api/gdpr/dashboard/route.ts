import { NextResponse } from 'next/server';
import { getAdminApiContext } from '../_shared';

export const dynamic = 'force-dynamic';

export async function GET() {
  const context = await getAdminApiContext();
  if ('error' in context) {
    return context.error;
  }

  try {
    const headers = {
      Authorization: `Bearer ${context.accessToken}`,
    };

    const [sarResponse, erasureResponse, logsResponse, policiesResponse] = await Promise.all([
      fetch(`${context.apiBaseUrl}/gdpr/sar?limit=20`, { headers, cache: 'no-store' }),
      fetch(`${context.apiBaseUrl}/gdpr/erasure?limit=20`, { headers, cache: 'no-store' }),
      fetch(`${context.apiBaseUrl}/gdpr/audit-logs?limit=20`, { headers, cache: 'no-store' }),
      fetch(`${context.apiBaseUrl}/gdpr/retention-policies`, { headers, cache: 'no-store' }),
    ]);

    const [sar, erasure, logs, policies] = await Promise.all([
      sarResponse.json(),
      erasureResponse.json(),
      logsResponse.json(),
      policiesResponse.json(),
    ]);

    return NextResponse.json(
      {
        sarRequests: (sar?.requests ?? []).map((request: any) => ({
          requestId: request.requestId,
          userId: request.userId,
          requestType: request.requestType,
          status: request.status,
          requestedAt: request.requestedAt,
          completedAt: request.completedAt,
          fileName: request.fileName,
          downloadAvailable: request.downloadAvailable,
          email: request.email,
        })),
        erasureRequests: (erasure?.requests ?? []).map((request: any) => ({
          requestId: request.requestId,
          userId: request.userId,
          requestType: request.requestType,
          status: request.status,
          requestedAt: request.requestedAt,
          scheduledFor: request.scheduledFor,
          completedAt: request.completedAt,
          reason: request.reason,
          result: request.result,
        })),
        auditLogs: (logs?.logs ?? []).map((log: any) => ({
          id: log.id,
          action: log.action,
          resourceType: log.resource_type,
          resourceId: log.resource_id,
          userId: log.user_id,
          timestamp: log.timestamp,
        })),
        retentionPolicies: (policies?.policies ?? []).map((policy: any) => ({
          id: policy.id,
          dataCategory: policy.data_category,
          retentionDays: policy.retention_days,
          legalBasis: policy.legal_basis,
          description: policy.description,
          isActive: policy.is_active,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load compliance dashboard' },
      { status: 502 }
    );
  }
}
