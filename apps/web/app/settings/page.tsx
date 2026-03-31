import { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { Header } from '../../components/oasis/Header';
import { authOptions } from '../../lib/auth/auth-options';
import { hasRole, normalizeAppRoles } from '../../lib/auth/roles';

export const metadata: Metadata = {
  title: 'Settings - Oasis Care',
  description: 'Review your account and session settings',
};

export const dynamic = 'force-dynamic';

function formatRole(role: string) {
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const roles = normalizeAppRoles((session as any)?.roles);
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Unknown user';
  const userEmail = session?.user?.email || 'No email available';
  const primaryRole = roles[0] ? formatRole(roles[0]) : 'No role assigned';
  const accessTokenAvailable = typeof (session as any)?.accessToken === 'string';
  const isAdmin = hasRole(roles, 'admin');
  const nextLinks = isAdmin
    ? [
        { href: '/visits', label: 'Open care queue' },
        { href: '/clients', label: 'Review clients' },
        { href: '/admin/medications', label: 'Medication library' },
        { href: '/admin/pilot', label: 'Pilot story' },
      ]
    : [
        { href: '/visits', label: 'Open visits' },
        { href: '/emar', label: 'Open eMAR' },
        { href: '/activity', label: "Today's totals" },
      ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-slate-500 mt-1">
            Review your account details and the current session state.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-heading text-xl font-semibold text-slate-900 mb-5">Signed-in account</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-slate-500">Name</dt>
                <dd className="mt-1 text-sm text-slate-900">{userName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Primary role</dt>
                <dd className="mt-1 text-sm text-slate-900">{primaryRole}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-slate-500">Email</dt>
                <dd className="mt-1 text-sm text-slate-900">{userEmail}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-slate-500">All roles</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {roles.length ? roles.map(formatRole).join(', ') : 'No roles available'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="font-heading text-xl font-semibold text-slate-900 mb-5">Access state</h2>
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-700">Authenticated session</p>
                <p className="mt-1 text-sm text-slate-500">
                  {session ? 'Your current app session is active.' : 'No active session detected.'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-700">API token availability</p>
                <p className="mt-1 text-sm text-slate-500">
                  {accessTokenAvailable
                    ? 'An access token is attached to this session for authenticated API calls.'
                    : 'No access token is currently attached to this session.'}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm font-medium text-amber-900">Need to switch users?</p>
                <p className="mt-1 text-sm text-amber-800">
                  Use the profile menu in the header to sign out before logging in with a different account.
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-heading text-xl font-semibold text-slate-900 mb-5">Where to work next</h2>
          <p className="mb-5 text-sm text-slate-500">
            Use these routes when you need to pick work back up quickly from this account.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {nextLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-heading text-xl font-semibold text-slate-900 mb-5">Policy and compliance references</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/privacy" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Privacy notice
            </Link>
            <Link href="/data-processing" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Data processing summary
            </Link>
            <Link href="/security" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Security summary
            </Link>
            <Link href="/subprocessors" className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Subprocessors
            </Link>
          </div>
          {isAdmin && (
            <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 p-4">
              <p className="text-sm font-medium text-blue-900">Pilot admin compliance console</p>
              <p className="mt-1 text-sm text-blue-800">
                Review subject access, erasure handling, retention enforcement, and audit evidence from one admin route.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  href="/admin/compliance"
                  className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Open compliance console
                </Link>
                <Link
                  href="/admin/pilot"
                  className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white"
                >
                  Open pilot story
                </Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
