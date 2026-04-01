import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '../../../../components/oasis/Header';
import { requireAdminSession } from '../../../../lib/auth/require-admin';
import { query } from '../../../../lib/graphql/client';
import {
  CLIENT_CARE_PLAN_AUDIT_HISTORY_QUERY,
  CLIENT_CARE_PLAN_HISTORY_QUERY,
  CLIENT_CARE_PLAN_QUERY,
  CLIENT_QUERY,
  type ClientCarePlanAuditHistoryQueryResponse,
  type ClientCarePlanHistoryQueryResponse,
  type ClientCarePlanQueryResponse,
  type ClientQueryResponse,
} from '../../../../lib/graphql/queries';
import CarePlanEditor from './CarePlanEditor';

export const metadata: Metadata = {
  title: 'Client Care Plan - Oasis Care',
  description: 'Draft, publish, and review structured client care guidance.',
};

export const dynamic = 'force-dynamic';

interface ClientCarePlanPageProps {
  params: {
    id: string;
  };
}

async function getClient(id: string) {
  try {
    const response = await query<ClientQueryResponse>(CLIENT_QUERY, { id });
    return response.client;
  } catch (error) {
    console.error('Failed to fetch client for care plan:', error);
    return null;
  }
}

async function getCarePlan(clientId: string) {
  try {
    const response = await query<ClientCarePlanQueryResponse>(CLIENT_CARE_PLAN_QUERY, { clientId });
    return response.clientCarePlan;
  } catch (error) {
    console.error('Failed to fetch client care plan:', error);
    return null;
  }
}

async function getCarePlanHistory(clientId: string) {
  try {
    const response = await query<ClientCarePlanHistoryQueryResponse>(CLIENT_CARE_PLAN_HISTORY_QUERY, { clientId });
    return response.clientCarePlanHistory;
  } catch (error) {
    console.error('Failed to fetch care-plan history:', error);
    return [];
  }
}

async function getCarePlanAuditHistory(clientId: string) {
  try {
    const response = await query<ClientCarePlanAuditHistoryQueryResponse>(CLIENT_CARE_PLAN_AUDIT_HISTORY_QUERY, { clientId });
    return response.clientCarePlanAuditHistory;
  } catch (error) {
    console.error('Failed to fetch care-plan audit history:', error);
    return [];
  }
}

export default async function ClientCarePlanPage({ params }: ClientCarePlanPageProps) {
  await requireAdminSession();

  const client = await getClient(params.id);

  if (!client) {
    notFound();
  }

  const [carePlan, history, auditHistory] = await Promise.all([
    getCarePlan(client.id),
    getCarePlanHistory(client.id),
    getCarePlanAuditHistory(client.id),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <nav className="mb-4 flex" aria-label="Breadcrumb">
            <ol role="list" className="flex items-center space-x-2">
              <li>
                <Link href="/clients" className="text-sm font-medium text-slate-500 hover:text-slate-700">
                  Clients
                </Link>
              </li>
              <li className="text-slate-300">/</li>
              <li>
                <Link href={`/clients/${client.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-700">
                  {client.fullName}
                </Link>
              </li>
              <li className="text-slate-300">/</li>
              <li className="text-sm font-medium text-slate-900">Care plan</li>
            </ol>
          </nav>
          <h1 className="font-heading text-3xl font-bold text-slate-900">
            {client.preferredName || client.fullName} Care Plan
          </h1>
          <p className="mt-1 text-slate-500">
            Maintain the staff-owned care record that carers read directly inside the visit workspace.
          </p>
        </div>

        <CarePlanEditor client={client} carePlan={carePlan} history={history} auditHistory={auditHistory} />
      </main>
    </div>
  );
}
