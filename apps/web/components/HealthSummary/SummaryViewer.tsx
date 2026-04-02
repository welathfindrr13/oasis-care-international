'use client';

import RiskIndicator from './RiskIndicator';

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
  approvedBy?: string | null;
  approvedAt?: string | null;
  feedback?: string | null;
  expiresAt: string;
  client?: {
    id: string;
    fullName: string;
    addressLine1: string;
    city: string;
    postcode: string;
  } | null;
  approver?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

interface SummaryViewerProps {
  summary: HealthSummary;
  className?: string;
}

export default function SummaryViewer({ summary, className = '' }: SummaryViewerProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRiskLevel = (level: string): 'green' | 'amber' | 'red' => {
    if (level === 'green') return 'green';
    if (level === 'amber') return 'amber';
    return 'red';
  };

  const isExpiringSoon = () => {
    const now = new Date();
    const expires = new Date(summary.expiresAt);
    const hoursUntilExpiry = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 6 && hoursUntilExpiry > 0;
  };

  const isExpired = () => {
    return new Date() > new Date(summary.expiresAt);
  };

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Health Summary
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {formatDate(summary.periodStart)} - {formatDate(summary.periodEnd)}
            </p>
            {summary.client && (
              <p className="text-sm text-gray-500">
                {summary.client.fullName} • {summary.client.city}
              </p>
            )}
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {/* Overall Risk Level */}
            {summary.riskLevels?.overall && (
              <RiskIndicator
                level={getRiskLevel(summary.riskLevels.overall)}
                label={`Overall: ${summary.riskLevels.overall}`}
                size="lg"
                data-testid="risk-indicator"
              />
            )}
            
            {/* Expiry Warning */}
            {isExpired() && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Expired
              </div>
            )}
            {isExpiringSoon() && !isExpired() && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Expiring Soon
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Overall Health Status */}
        {summary.summaryJson?.overall_health && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              Overall Health Status
            </h3>
            <p className="text-blue-800">
              {summary.summaryJson.overall_health}
            </p>
          </div>
        )}

        {/* Risk Levels Grid */}
        {summary.riskLevels && Object.keys(summary.riskLevels).length > 1 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Risk Assessment
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(summary.riskLevels).map(([key, value]) => {
                if (key === 'overall') return null;
                return (
                  <RiskIndicator
                    key={key}
                    level={getRiskLevel(value as string)}
                    label={`${key.replace('_', ' ')}: ${value}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Key Observations */}
        {summary.summaryJson?.key_observations && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Key Observations
            </h3>
            <ul className="space-y-2">
              {summary.summaryJson.key_observations.map((observation: string, index: number) => (
                <li key={index} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-gray-700">{observation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {summary.summaryJson?.recommendations && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Recommendations
            </h3>
            <ul className="space-y-2">
              {summary.summaryJson.recommendations.map((recommendation: string, index: number) => (
                <li key={index} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Visit Summary */}
        {summary.summaryJson?.visit_summary && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Visit Summary
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(summary.summaryJson.visit_summary).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {value as string}
                    </div>
                    <div className="text-sm text-gray-600 capitalize">
                      {key.replace('_', ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            Generated by {summary.generatedBy} on {formatDateTime(summary.generatedAt)}
          </div>
          
          <div className="flex items-center gap-4">
            {summary.status === 'PENDING' && (
              <div className="text-amber-600">
                Expires {formatDateTime(summary.expiresAt)}
              </div>
            )}
            
            {summary.approver && summary.approvedAt && (
              <div>
                {summary.status === 'APPROVED' ? 'Approved' : 'Processed'} by {summary.approver.firstName} {summary.approver.lastName} on {formatDateTime(summary.approvedAt)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
