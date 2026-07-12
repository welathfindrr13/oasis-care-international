'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useSession } from 'next-auth/react';
import { Header } from '../../components/oasis/Header';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { InstallAppPrompt } from '../../components/pwa/InstallAppPrompt';
import { useClientAccess } from '../../components/providers/ClientAccessProvider';
import { resolveAuthMode } from '../../lib/auth/mode';

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

export default function SettingsPage() {
  const authMode = resolveAuthMode({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: process.env.NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER,
    NEXT_PUBLIC_LOCAL_AUTH_ENABLED: process.env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED,
  } as NodeJS.ProcessEnv);
  return authMode === 'clerk' ? <ClerkSettings /> : <NextAuthSettings />;
}

function ClerkSettings() {
  const { user } = useUser();
  return (
    <SettingsContent
      userName={user?.fullName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'User'}
      userEmail={user?.primaryEmailAddress?.emailAddress || ''}
    />
  );
}

function NextAuthSettings() {
  const { data: session } = useSession();
  return (
    <SettingsContent
      userName={session?.user?.name || session?.user?.email?.split('@')[0] || 'User'}
      userEmail={session?.user?.email || ''}
    />
  );
}

function SettingsContent({ userName, userEmail }: { userName: string; userEmail: string }) {
  const { roles, accessContext, isAdmin, isCarer } = useClientAccess();
  const primaryRole = roles[0] || 'Access pending';
  const isRestrictedManagement =
    accessContext.surface === 'staff' && accessContext.homePath === '/settings';

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">
            Settings
          </h1>
          <p className="mt-1 text-slate-500">
            Review your account details, install Oasis and open the pages available to you
          </p>
        </div>

        <div className="space-y-6">
          <InstallAppPrompt />

          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-slate-900 font-heading">
                Profile
              </h2>
              <p className="text-sm text-slate-500">
                Your authenticated session details
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{userName}</p>
                    <p className="text-sm text-slate-500">{userEmail}</p>
                  </div>
                </div>

                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-4">
                    <dt className="text-sm text-slate-500">Primary role</dt>
                    <dd className="mt-1 font-medium text-slate-900">{formatRole(primaryRole)}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <dt className="text-sm text-slate-500">Access</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {isAdmin
                        ? 'Administrative workspace'
                        : isCarer
                          ? 'Carer workspace'
                          : isRestrictedManagement
                            ? 'Profile and settings access'
                            : 'Standard access'}
                    </dd>
                  </div>
                </dl>
              </div>
            </CardContent>
          </Card>

          {!isRestrictedManagement && <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-slate-900 font-heading">
                Operational shortcuts
              </h2>
              <p className="text-sm text-slate-500">
                Jump back into the parts of Oasis you use most
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {!isRestrictedManagement && (
                  <Button asChild variant="ghost">
                    <Link href="/today">Open Today</Link>
                  </Button>
                )}
                {isAdmin && (
                  <>
                    <Button asChild variant="ghost">
                      <Link href="/schedule">Open Schedule</Link>
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href="/people">Open People</Link>
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href="/family-updates">Open Family Updates</Link>
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href="/medication">Open Medication Round</Link>
                    </Button>
                  </>
                )}
                {isCarer && (
                  <Button asChild variant="ghost">
                    <Link href="/visits">Open my visits</Link>
                  </Button>
                )}
                {(isCarer || isAdmin) && (
                  <Button asChild variant="ghost">
                    <Link href="/shift">{isCarer ? 'Open shift clock' : 'Open shift overview'}</Link>
                  </Button>
                )}
                {isAdmin && (
                  <Button asChild variant="ghost">
                    <Link href="/admin/carers">Open carer directory</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>}

          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-slate-900 font-heading">
                What is real today
              </h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  This page shows your account details and the pages currently available to you. Notification and
                  preference controls are not available yet.
                </p>
                <p>
                  Install Oasis above to add it to this device&apos;s home screen. Use the profile menu to sign out
                  when you finish using Oasis.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
