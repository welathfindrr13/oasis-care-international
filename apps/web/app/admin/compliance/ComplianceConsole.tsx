'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { Button, buttonVariants } from '../../../components/ui/Button';
import { formatMaskedActorLabel, type ComplianceSubjectContext } from '../../../lib/compliance';

type SarRequest = {
  requestId: string;
  userId: string;
  requestType: string;
  status: string;
  requestedAt: string;
  completedAt?: string | null;
  fileName?: string | null;
  downloadAvailable?: boolean;
  email?: string | null;
};

type ErasureRequest = {
  requestId: string;
  userId: string;
  requestType: string;
  status: string;
  requestedAt: string;
  completedAt?: string | null;
  reason?: string | null;
  result?: Record<string, unknown> | null;
};

type AuditLog = {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  userId?: string | null;
  timestamp: string;
};

type RetentionPolicy = {
  id: string;
  dataCategory: string;
  retentionDays: number;
  legalBasis: string;
  description?: string | null;
  isActive: boolean;
};

type Props = {
  sarRequests: SarRequest[];
  erasureRequests: ErasureRequest[];
  auditLogs: AuditLog[];
  retentionPolicies: RetentionPolicy[];
  selectedSubject?: ComplianceSubjectContext | null;
};

function formatStamp(value?: string | null) {
  if (!value) return 'Not completed';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(value));
}

export function ComplianceConsole({
  sarRequests,
  erasureRequests,
  auditLogs,
  retentionPolicies,
  selectedSubject,
}: Props) {
  const router = useRouter();
  const [sarUserId, setSarUserId] = useState(selectedSubject?.id ?? '');
  const [sarEmail, setSarEmail] = useState('');
  const [erasureUserId, setErasureUserId] = useState(selectedSubject?.id ?? '');
  const [erasureReason, setErasureReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSarUserId(selectedSubject?.id ?? '');
    setErasureUserId(selectedSubject?.id ?? '');
  }, [selectedSubject?.id]);

  const outstandingCounts = useMemo(
    () => ({
      sar: sarRequests.filter((request) => request.status !== 'completed').length,
      erasure: erasureRequests.filter((request) => request.status !== 'completed' && request.status !== 'cancelled').length,
    }),
    [erasureRequests, sarRequests]
  );

  const runAction = (action: () => Promise<void>, successMessage: string) => {
    setFeedback(null);
    startTransition(async () => {
      try {
        await action();
        setFeedback(successMessage);
        router.refresh();
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'Request failed');
      }
    });
  };

  return (
    <div className="grid gap-6">
      {selectedSubject && (
        <Card>
          <CardHeader>
            <h2 className="font-heading text-lg font-semibold text-slate-900">Selected subject context</h2>
            <p className="text-sm text-slate-500">
              Use this context to queue rights handling without re-entering the client UUID.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{selectedSubject.name || 'Linked subject'}</p>
              <p className="mt-1 break-all text-sm text-slate-600">{selectedSubject.id}</p>
            </div>
            <Link href={`/clients/${selectedSubject.id}`} className={buttonVariants({ variant: 'outline' })}>
              Open client record
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <h2 className="font-heading text-lg font-semibold text-slate-900">Open SARs</h2>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{outstandingCounts.sar}</p>
            <p className="mt-2 text-sm text-slate-500">Subject access requests awaiting fulfilment or review.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="font-heading text-lg font-semibold text-slate-900">Open erasure</h2>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{outstandingCounts.erasure}</p>
            <p className="mt-2 text-sm text-slate-500">Requests that still need retention-aware handling.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="font-heading text-lg font-semibold text-slate-900">Retention policies</h2>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{retentionPolicies.length}</p>
            <p className="mt-2 text-sm text-slate-500">Active policy definitions currently visible in staging.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="font-heading text-lg font-semibold text-slate-900">Audit visibility</h2>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-900">{auditLogs.length}</p>
            <p className="mt-2 text-sm text-slate-500">Recent masked audit records available for compliance review.</p>
          </CardContent>
        </Card>
      </div>

      {feedback && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          {feedback}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr,1.1fr,0.9fr]">
        <Card>
          <CardHeader>
            <h2 className="font-heading text-xl font-semibold text-slate-900">Subject access requests</h2>
            <p className="text-sm text-slate-500">Create, process, and download admin-mediated subject access exports.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                runAction(async () => {
                  const response = await fetch('/api/gdpr/sar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userId: sarUserId.trim(),
                      email: sarEmail.trim() || undefined,
                      requestType: 'full_record',
                    }),
                  });
                  const payload = await response.json().catch(() => ({}));
                  if (!response.ok) {
                    throw new Error(payload.error || payload.message || 'Failed to create subject access request');
                  }
                  setSarUserId('');
                  setSarEmail('');
                }, 'Subject access request queued.');
              }}
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject user ID</label>
                <input
                  value={sarUserId}
                  onChange={(event) => setSarUserId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Client or carer UUID"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notification email</label>
                <input
                  value={sarEmail}
                  onChange={(event) => setSarEmail(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Optional admin contact email"
                />
              </div>
              <Button type="submit" variant="primary" disabled={isPending || !sarUserId.trim()}>
                Queue subject access request
              </Button>
            </form>

            <div className="space-y-3">
              {sarRequests.length ? sarRequests.map((request) => (
                <div key={request.requestId} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{request.userId}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {request.requestType} · requested {formatStamp(request.requestedAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700">
                      {request.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {request.status !== 'completed' && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isPending}
                        onClick={() =>
                          runAction(async () => {
                            const response = await fetch(`/api/gdpr/sar/${request.requestId}/process`, { method: 'POST' });
                            const payload = await response.json().catch(() => ({}));
                            if (!response.ok) {
                              throw new Error(payload.error || payload.message || 'Failed to process request');
                            }
                          }, 'Subject access request processed.')
                        }
                      >
                        Process request
                      </Button>
                    )}
                    {request.status === 'completed' && request.downloadAvailable && (
                      <Link href={`/api/gdpr/sar/${request.requestId}/download`} className={buttonVariants({ variant: 'ghost' })}>
                        Download export
                      </Link>
                    )}
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No subject access requests recorded yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-heading text-xl font-semibold text-slate-900">Erasure requests</h2>
            <p className="text-sm text-slate-500">Retention-aware handling keeps operational evidence while removing optional data.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                runAction(async () => {
                  const response = await fetch('/api/gdpr/erasure', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userId: erasureUserId.trim(),
                      requestType: 'data_subject_request',
                      reason: erasureReason.trim() || undefined,
                    }),
                  });
                  const payload = await response.json().catch(() => ({}));
                  if (!response.ok) {
                    throw new Error(payload.error || payload.message || 'Failed to create erasure request');
                  }
                  setErasureUserId('');
                  setErasureReason('');
                }, 'Erasure request queued.');
              }}
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject user ID</label>
                <input
                  value={erasureUserId}
                  onChange={(event) => setErasureUserId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Client or carer UUID"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <textarea
                  value={erasureReason}
                  onChange={(event) => setErasureReason(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Optional request notes or internal reference"
                />
              </div>
              <Button type="submit" variant="primary" disabled={isPending || !erasureUserId.trim()}>
                Queue erasure request
              </Button>
            </form>

            <div className="space-y-3">
              {erasureRequests.length ? erasureRequests.map((request) => (
                <div key={request.requestId} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{request.userId}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {request.requestType} · requested {formatStamp(request.requestedAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-700">
                      {request.status}
                    </span>
                  </div>
                  {request.result && (
                    <p className="mt-2 text-xs text-slate-500">
                      {request.status === 'completed'
                        ? 'Execution result stored on the request record.'
                        : 'Awaiting retention-aware processing.'}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {request.status !== 'completed' && request.status !== 'cancelled' && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isPending}
                        onClick={() =>
                          runAction(async () => {
                            const response = await fetch(`/api/gdpr/erasure/${request.requestId}/process`, { method: 'POST' });
                            const payload = await response.json().catch(() => ({}));
                            if (!response.ok) {
                              throw new Error(payload.error || payload.message || 'Failed to process erasure request');
                            }
                          }, 'Erasure request processed.')
                        }
                      >
                        Process request
                      </Button>
                    )}
                  </div>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No erasure requests recorded yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <h2 className="font-heading text-xl font-semibold text-slate-900">Retention and evidence</h2>
              <p className="text-sm text-slate-500">Policies stay visible and enforcement is explicit.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {retentionPolicies.length ? retentionPolicies.map((policy) => (
                <div key={policy.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{policy.dataCategory}</p>
                      <p className="mt-1 text-xs text-slate-500">{policy.legalBasis}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{policy.retentionDays} days</span>
                  </div>
                  {policy.description && <p className="mt-2 text-sm text-slate-600">{policy.description}</p>}
                </div>
              )) : (
                <p className="text-sm text-slate-500">No active retention policies are visible.</p>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() =>
                  runAction(async () => {
                    const response = await fetch('/api/gdpr/retention-policies/enforce', { method: 'POST' });
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok) {
                      throw new Error(payload.error || payload.message || 'Failed to enforce retention policies');
                    }
                  }, 'Retention policies enforced.')
                }
              >
                Run retention enforcement
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-heading text-xl font-semibold text-slate-900">Audit trail</h2>
              <p className="text-sm text-slate-500">Recent masked audit events for compliance review.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {auditLogs.length ? auditLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">{log.action}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {log.resourceType}{log.resourceId ? ` · ${log.resourceId}` : ''} · {formatStamp(log.timestamp)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Actor: {formatMaskedActorLabel(log.userId)}</p>
                </div>
              )) : (
                <p className="text-sm text-slate-500">No audit logs are available yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-heading text-xl font-semibold text-slate-900">Legal references</h2>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Link href="/privacy" className={buttonVariants({ variant: 'ghost' })}>Privacy notice</Link>
              <Link href="/data-processing" className={buttonVariants({ variant: 'ghost' })}>Data processing summary</Link>
              <Link href="/security" className={buttonVariants({ variant: 'ghost' })}>Security summary</Link>
              <Link href="/subprocessors" className={buttonVariants({ variant: 'ghost' })}>Subprocessors</Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
