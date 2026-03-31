import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '../../../components/oasis/Header';
import { requireAdminSession } from '../../../lib/auth/require-admin';
import ClientForm from '../ClientForm';

export const metadata: Metadata = {
  title: 'Add New Client - Oasis Care',
  description: 'Register a new client and capture the operational profile needed for care delivery.',
};

export const dynamic = 'force-dynamic';

export default async function NewClientPage() {
  await requireAdminSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <nav className="mb-4 flex" aria-label="Breadcrumb">
            <ol role="list" className="flex items-center space-x-2">
              <li>
                <Link href="/clients" className="text-sm font-medium text-slate-500 hover:text-slate-700">
                  Clients
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <svg className="h-5 w-5 flex-shrink-0 text-slate-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02z" clipRule="evenodd" />
                  </svg>
                  <span className="ml-2 text-sm font-medium text-slate-900">Add New Client</span>
                </div>
              </li>
            </ol>
          </nav>
          <h1 className="font-heading text-3xl font-bold text-slate-900">
            Add New Client
          </h1>
          <p className="mt-1 text-slate-500">
            Register the client and capture the profile information carers will need before visits begin.
          </p>
        </div>

        <ClientForm mode="create" />
      </main>
    </div>
  );
}
