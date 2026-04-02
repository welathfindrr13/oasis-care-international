'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApprovalControls, SummaryViewer } from '../../../../components/HealthSummary';
import { Button, buttonVariants } from '../../../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../../../components/ui/Card';
import { clientQuery } from '../../../../lib/graphql/client-side';
import { type Client, type HealthSummary } from '../../../../lib/graphql/queries';
import { formatDateTime } from '../../../../lib/time';

const SUMMARY_FIELDS = `
  id
  clientId
  periodStart
  periodEnd
  summaryJson
  riskLevels
  generatedAt
  generatedBy
  approvedBy
  approvedAt
  feedback
  expiresAt
  status
  client {
    id
    fullName
    addressLine1
    addressLine2
    city
    postcode
  }
  approver {
    id
    firstName
    lastName
    email
    phone
  }
  createdAt
  updatedAt
`;

const GENERATE_SUMMARY_MUTATION = `
  mutation GenerateSummary($input: GenerateSummaryInput!) {
    generateSummary(input: $input) {
      ${SUMMARY_FIELDS}
    }
  }
`;

const APPROVE_SUMMARY_MUTATION = `
  mutation ApproveSummary($input: ApproveSummaryInput!) {
    approveSummary(input: $input) {
      ${SUMMARY_FIELDS}
    }
  }
`;

interface SummaryWorkspaceProps {
  client: Client;
  initialHistory: HealthSummary[];
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getLastCompletedOperationalWeek() {
  const today = new Date();
  const anchor = new Date(today);
  anchor.setHours(0, 0, 0, 0);

  const day = anchor.getDay();
  const daysSinceFriday = (day - 5 + 7) % 7;
  const periodEnd = new Date(anchor);
  periodEnd.setDate(anchor.getDate() - daysSinceFriday);

  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodEnd.getDate() - 7);

  return {
    periodStart: toIsoDate(periodStart),
    periodEnd: toIsoDate(periodEnd),
  };
}

function formatPeriod(periodStart: string, periodEnd: string) {
  return `${new Date(periodStart).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })} to ${new Date(periodEnd).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

export default function SummaryWorkspace({ client, initialHistory }: SummaryWorkspaceProps) {
  const router = useRouter();
  const [history, setHistory] = useState(initialHistory);
  const [selectedSummaryId, setSelectedSummaryId] = useState(initialHistory[0]?.id ?? null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedSummary = useMemo(
    () => history.find((summary) => summary.id === selectedSummaryId) ?? history[0] ?? null,
    [history, selectedSummaryId]
  );

  async function handleGenerateSummary() {
    setIsGenerating(true);
    setError(null);
    setFeedback(null);

    try {
      const period = getLastCompletedOperationalWeek();
      const response = await clientQuery<{ generateSummary: HealthSummary }>(GENERATE_SUMMARY_MUTATION, {
        input: {
          clientId: client.id,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
        },
      });

      const nextSummary = response.generateSummary;
      setHistory((current) => {
        const deduped = current.filter((item) => item.id !== nextSummary.id);
        return [nextSummary, ...deduped];
      });
      setSelectedSummaryId(nextSummary.id);
      setFeedback(`AI summary ready for ${formatPeriod(nextSummary.periodStart, nextSummary.periodEnd)}.`);
      router.refresh();
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to generate the AI summary right now.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleApproveSummary(summaryId: string, feedbackText?: string) {
    setError(null);
    setFeedback(null);

    try {
      const response = await clientQuery<{ approveSummary: HealthSummary }>(APPROVE_SUMMARY_MUTATION, {
        input: {
          summaryId,
          feedback: feedbackText,
        },
      });

      const updatedSummary = response.approveSummary;
      setHistory((current) =>
        current.map((item) => (item.id === updatedSummary.id ? updatedSummary : item))
      );
      setSelectedSummaryId(updatedSummary.id);
      setFeedback(
        updatedSummary.status === 'REJECTED'
          ? 'Summary marked for revision.'
          : 'Summary approved and recorded.'
      );
      router.refresh();
    } catch (submitError: any) {
      setError(submitError.message || 'Unable to update the summary approval right now.');
      throw submitError;
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Weekly AI draft</h2>
              <p className="text-sm text-slate-500">
                The generator uses the last completed Friday-to-Thursday care week and produces a staff-reviewed draft,
                not a client-facing clinical record.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/clients/${client.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                Back to client
              </Link>
              <Button type="button" size="sm" onClick={handleGenerateSummary} disabled={isGenerating}>
                {isGenerating ? 'Generating summary...' : 'Generate latest weekly summary'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Uses visit notes, task completion, and medication outcomes already recorded in Oasis. Approved summaries stay
            visible here with their review status and timestamp.
          </div>
          {feedback ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {feedback}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
          ) : null}
        </CardContent>
      </Card>

      {selectedSummary ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
          <div className="space-y-6">
            <ApprovalControls
              summaryId={selectedSummary.id}
              status={selectedSummary.status}
              approvedBy={
                selectedSummary.approver
                  ? `${selectedSummary.approver.firstName} ${selectedSummary.approver.lastName}`
                  : undefined
              }
              approvedAt={selectedSummary.approvedAt ?? undefined}
              feedback={selectedSummary.feedback ?? undefined}
              userRole="admin"
              onApprove={handleApproveSummary}
            />
            <SummaryViewer summary={selectedSummary} />
          </div>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-900">Recent AI summaries</h2>
              <p className="text-sm text-slate-500">Open the latest summary or review older approved drafts.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.map((summary) => {
                const isSelected = summary.id === selectedSummary.id;
                return (
                  <button
                    key={summary.id}
                    type="button"
                    onClick={() => setSelectedSummaryId(summary.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-teal-300 bg-teal-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {formatPeriod(summary.periodStart, summary.periodEnd)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Generated {formatDateTime(summary.generatedAt)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          summary.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : summary.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {summary.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <h2 className="text-xl font-semibold text-slate-900">No AI summary generated yet</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Generate the latest weekly summary to review a Bedrock draft built from recorded care activity for this client.
            </p>
            <Button type="button" className="mt-6" onClick={handleGenerateSummary} disabled={isGenerating}>
              {isGenerating ? 'Generating summary...' : 'Generate latest weekly summary'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
