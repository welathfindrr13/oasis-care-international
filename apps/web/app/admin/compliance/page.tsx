import { cookies } from 'next/headers';
import { Header } from '../../../components/oasis/Header';
import { requireAdminSession } from '../../../lib/auth/require-admin';
import { getComplianceSubjectContext } from '../../../lib/compliance';
import { getSiteBaseUrl } from '../../../lib/url';
import { ComplianceConsole } from './ComplianceConsole';

type ComplianceDashboardResponse = {
  sarRequests: any[];
  erasureRequests: any[];
  auditLogs: any[];
  retentionPolicies: any[];
};

async function getComplianceDashboard(): Promise<ComplianceDashboardResponse> {
  await requireAdminSession();

  const baseUrl = getSiteBaseUrl();
  const response = await fetch(`${baseUrl}/api/gdpr/dashboard`, {
    cache: 'no-store',
    headers: {
      cookie: cookies().toString(),
    },
  });

  if (!response.ok) {
    return {
      sarRequests: [],
      erasureRequests: [],
      auditLogs: [],
      retentionPolicies: [],
    };
  }

  return response.json();
}

export default async function AdminCompliancePage({
  searchParams,
}: {
  searchParams?: {
    subjectId?: string;
    subjectName?: string;
    subjectType?: string;
  };
}) {
  const dashboard = await getComplianceDashboard();
  const selectedSubject = getComplianceSubjectContext(searchParams);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 max-w-3xl">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Privacy and compliance</h1>
          <p className="mt-2 text-slate-500">
            Admin-only handling for subject access, erasure, retention enforcement, and legal references.
          </p>
        </div>

        <ComplianceConsole
          sarRequests={dashboard.sarRequests}
          erasureRequests={dashboard.erasureRequests}
          auditLogs={dashboard.auditLogs}
          retentionPolicies={dashboard.retentionPolicies}
          selectedSubject={selectedSubject}
        />
      </main>
    </div>
  );
}
