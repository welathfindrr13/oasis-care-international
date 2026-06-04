'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import SummaryViewer from '../../../../components/HealthSummary/SummaryViewer';
import ApprovalControls from '../../../../components/HealthSummary/ApprovalControls';
import { Header } from '../../../../components/oasis/Header';
import { clientQuery } from '../../../../lib/graphql/client-side';

interface HealthSummary {
  id: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  summaryJson: any;
  riskLevels: any;
  generatedAt: string;
  generatedBy: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  feedback?: string;
  expiresAt: string;
  client?: {
    id: string;
    fullName: string;
    addressLine1: string;
    city: string;
    postcode: string;
  };
  approver?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function SummaryPage() {
  const params = useParams();
  const clientId = params.id as string;
  const { data: session } = useSession();
  
  const [currentSummary, setCurrentSummary] = useState<HealthSummary | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const userRole = ((session as any)?.roles?.[0] || 'carer').toLowerCase();
  const canManageAi = userRole === 'admin' || userRole === 'manager';

  const loadCurrentSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await clientQuery<{ currentWeekSummary: HealthSummary | null }>(`
        query CurrentWeekSummary($clientId: ID!) {
          currentWeekSummary(clientId: $clientId) {
            id
            clientId
            periodStart
            periodEnd
            summaryJson
            riskLevels
            generatedAt
            generatedBy
            status
            approvedBy
            approvedAt
            feedback
            expiresAt
            client {
              id
              fullName
              addressLine1
              city
              postcode
            }
          }
        }
      `, { clientId });

      setCurrentSummary(response.currentWeekSummary || null);

      if (canManageAi) {
        const enabledResponse = await clientQuery<{ isAiSummaryEnabledForClientOrganization: boolean }>(`
          query IsAiSummaryEnabled($clientId: ID!) {
            isAiSummaryEnabledForClientOrganization(clientId: $clientId)
          }
        `, { clientId });
        setAiEnabled(Boolean(enabledResponse.isAiSummaryEnabledForClientOrganization));
      } else {
        setAiEnabled(null);
      }
    } catch (err) {
      setError('Failed to load health summary');
      console.error('Error loading summary:', err);
    } finally {
      setLoading(false);
    }
  }, [canManageAi, clientId]);

  useEffect(() => {
    loadCurrentSummary();
  }, [loadCurrentSummary]);

  const handleGenerateSummary = async () => {
    if (canManageAi && aiEnabled === false) {
      setError('AI summary is disabled for this organization. Enable it first.');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const response = await clientQuery<{ generateSummary: HealthSummary }>(`
        mutation GenerateSummary($input: GenerateSummaryInput!) {
          generateSummary(input: $input) {
            id
            clientId
            periodStart
            periodEnd
            summaryJson
            riskLevels
            generatedAt
            generatedBy
            status
            expiresAt
            client {
              id
              fullName
              addressLine1
              city
              postcode
            }
          }
        }
      `, {
        input: {
          clientId,
          periodStart: weekStart.toISOString(),
          periodEnd: weekEnd.toISOString()
        }
      });

      setCurrentSummary(response.generateSummary || null);
    } catch (err) {
      setError('Failed to generate health summary');
      console.error('Error generating summary:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleAiEnabled = async (enabled: boolean) => {
    try {
      setIsTogglingAi(true);
      setError(null);
      await clientQuery<{ setAiSummaryEnabledForClientOrganization: boolean }>(`
        mutation SetAiSummaryEnabled($clientId: ID!, $enabled: Boolean!) {
          setAiSummaryEnabledForClientOrganization(clientId: $clientId, enabled: $enabled)
        }
      `, { clientId, enabled });
      setAiEnabled(enabled);
    } catch (err: any) {
      setError(err?.message || 'Failed to update AI summary setting');
    } finally {
      setIsTogglingAi(false);
    }
  };

  const handleApproveSummary = async (summaryId: string, feedback?: string) => {
    try {
      const response = await clientQuery<{ approveSummary: Pick<HealthSummary, 'status' | 'approvedBy' | 'approvedAt' | 'feedback'> }>(`
        mutation ApproveSummary($input: ApproveSummaryInput!) {
          approveSummary(input: $input) {
            id
            status
            approvedBy
            approvedAt
            feedback
          }
        }
      `, {
        input: {
          summaryId,
          feedback
        }
      });

      // Update the current summary with approval data
      if (currentSummary && response.approveSummary) {
        setCurrentSummary({
          ...currentSummary,
          status: response.approveSummary.status as 'PENDING' | 'APPROVED' | 'REJECTED',
          approvedBy: response.approveSummary.approvedBy,
          approvedAt: response.approveSummary.approvedAt,
          feedback: response.approveSummary.feedback
        });
      }
    } catch (err) {
      console.error('Error approving summary:', err);
      throw err;
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      
      // Mock PDF export - in production this would use @react-pdf/renderer
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create a simple text download for demo
      const summaryText = `
Health Summary Report
${currentSummary?.client?.fullName}
Period: ${new Date(currentSummary?.periodStart || '').toLocaleDateString()} - ${new Date(currentSummary?.periodEnd || '').toLocaleDateString()}

Overall Health: ${currentSummary?.summaryJson?.overall_health || 'N/A'}

Key Observations:
${currentSummary?.summaryJson?.key_observations?.map((obs: string, i: number) => `${i + 1}. ${obs}`).join('\n') || 'None'}

Recommendations:
${currentSummary?.summaryJson?.recommendations?.map((rec: string, i: number) => `${i + 1}. ${rec}`).join('\n') || 'None'}

Generated: ${new Date(currentSummary?.generatedAt || '').toLocaleString()}
Status: ${currentSummary?.status}
      `;

      const blob = new Blob([summaryText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `health-summary-${currentSummary?.client?.fullName?.replace(/\s+/g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            AI Health Summary
          </h1>
          <p className="text-gray-600">
            AI-generated health insights based on recent care visits and observations.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-800 font-medium">Error</span>
            </div>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        )}

        {canManageAi && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-900">Organization AI Summary</p>
                <p className="text-xs text-slate-500">
                  {aiEnabled === null ? 'Loading setting...' : aiEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <button
                type="button"
                disabled={isTogglingAi || aiEnabled === null}
                onClick={() => handleToggleAiEnabled(!(aiEnabled === true))}
                className="px-3 py-2 text-sm bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50"
              >
                {isTogglingAi ? 'Saving...' : aiEnabled ? 'Disable AI' : 'Enable AI'}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleGenerateSummary}
            disabled={isGenerating || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Summary...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Summary
              </>
            )}
          </button>

          {currentSummary && (
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export PDF
                </>
              )}
            </button>
          )}

          <button
            onClick={loadCurrentSummary}
            disabled={loading}
            className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
            title="Refresh"
          >
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-lg border p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-6 bg-gray-300 rounded w-1/3"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-300 rounded"></div>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      ) : currentSummary ? (
        <div className="space-y-6">
          {/* Approval Controls */}
          <ApprovalControls
            summaryId={currentSummary.id}
            status={currentSummary.status}
            approvedBy={
              currentSummary.approver
                ? `${currentSummary.approver.firstName} ${currentSummary.approver.lastName}`
                : undefined
            }
            approvedAt={currentSummary.approvedAt}
            feedback={currentSummary.feedback}
            userRole={userRole}
            onApprove={handleApproveSummary}
          />

          {/* Summary Viewer */}
          <SummaryViewer summary={currentSummary} />
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-8 text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Health Summary Available
          </h3>
          <p className="text-gray-600 mb-4">
            There is no health summary for the current week. Generate one using AI analysis of recent care visits.
          </p>
        </div>
        )}
      </main>
    </div>
  );
}
