'use client';

import { SignIn } from '@clerk/nextjs';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { isLocalAuthEnabled, resolveAuthMode } from '../../lib/auth/mode';
import { normalizeCallbackUrl } from './callback-url';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = normalizeCallbackUrl(
    searchParams.get('callbackUrl'),
    process.env.NEXT_PUBLIC_SITE_URL,
  );
  const error = searchParams.get('error');
  const localAuthEnabled = isLocalAuthEnabled({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_LOCAL_AUTH_ENABLED: process.env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED,
  } as NodeJS.ProcessEnv);
  const authMode = resolveAuthMode({
    NODE_ENV: process.env.NODE_ENV,
    AUTH_IDENTITY_PROVIDER: process.env.NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER,
    NEXT_PUBLIC_LOCAL_AUTH_ENABLED: process.env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED,
  } as NodeJS.ProcessEnv);
  const [role, setRole] = useState('admin');
  const errorMessage =
    error === 'OAuthCallback'
      ? 'We could not complete sign-in. Try again.'
      : error === 'CredentialsSignin'
      ? 'We could not sign you in. Check your details and try again.'
      : error
      ? 'Sign-in is not available right now. Try again or contact your Manager or Oasis support.'
      : null;

  async function handleLocalSignIn() {
    const result = await signIn('oasis-local', {
      redirect: false,
      email: `${role}@local.dev`,
      name: role === 'admin' ? 'Local Admin' : role === 'carer' ? 'Local Carer' : 'Family Viewer',
      role,
      organizationId: '',
    });

    if (result?.ok) {
      router.push(callbackUrl);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-oasis-canvas text-oasis-ink">
      <main className="flex flex-1 items-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-lg border border-oasis-border bg-white shadow-sm lg:grid-cols-[minmax(0,0.8fr)_minmax(24rem,1.2fr)]">
          <section className="border-b border-oasis-border bg-oasis-teal-soft p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-oasis-teal-dark hover:text-oasis-teal"
            >
              <span aria-hidden="true">←</span>
              Back to Oasis Care
            </Link>
            <div className="mt-10 border-l-4 border-oasis-teal pl-5">
              <p className="font-heading text-xl font-bold text-oasis-ink">Oasis Care</p>
              <p className="mt-3 max-w-sm text-base leading-7 text-oasis-muted">
                Care records for your organisation.
              </p>
            </div>
            <div className="mt-10 border-t border-oasis-border pt-6">
              <p className="text-base font-bold text-oasis-ink">Before you sign in</p>
              <p className="mt-2 text-sm leading-6 text-oasis-muted">
                Use the account provided by your organisation. What you can open depends on your assigned access.
              </p>
            </div>
          </section>

          <section className="p-6 sm:p-8 lg:p-10" aria-labelledby="sign-in-heading">
            <div className="max-w-md">
              <h1 id="sign-in-heading" className="text-3xl font-bold text-oasis-ink sm:text-4xl">
                Sign in to Oasis Care
              </h1>
              <p className="mt-3 text-base leading-7 text-oasis-muted">
                {localAuthEnabled
                  ? 'Choose a local workspace for product testing.'
                  : authMode === 'clerk'
                  ? 'Sign in with your organisation account.'
                  : 'Sign in to open your care workspace.'}
              </p>
            </div>

            {errorMessage && (
              <div className="mt-6 rounded-md border border-oasis-danger bg-oasis-danger-soft p-4" role="alert">
                <p className="text-sm font-semibold text-oasis-danger">{errorMessage}</p>
              </div>
            )}

            <div className="mt-8 max-w-md">
              {localAuthEnabled ? (
                <div className="space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-oasis-ink">Workspace</span>
                    <select value={role} onChange={(event) => setRole(event.target.value)}>
                      <option value="admin">Manager Today</option>
                      <option value="carer">Carer workspace</option>
                      <option value="user">Family view</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={handleLocalSignIn}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-md border border-oasis-teal bg-oasis-teal px-5 py-3 font-semibold text-white hover:border-oasis-teal-dark hover:bg-oasis-teal-dark"
                  >
                    Continue
                  </button>
                </div>
              ) : authMode === 'clerk' ? (
                <div className="flex justify-center">
                  <SignIn
                    routing="hash"
                    transferable={false}
                    forceRedirectUrl={callbackUrl}
                    appearance={{
                      elements: {
                        rootBox: 'w-full',
                        card: 'w-full border-0 shadow-none p-0',
                        footerAction: 'hidden',
                      },
                    }}
                  />
                </div>
              ) : (
                <div className="rounded-md border border-oasis-border bg-oasis-canvas p-4" role="status">
                  <p className="text-sm font-semibold text-oasis-ink">Sign-in is not configured here.</p>
                  <p className="mt-2 text-sm leading-6 text-oasis-muted">Contact Oasis support.</p>
                </div>
              )}
            </div>

            <div className="mt-8 max-w-md border-t border-oasis-border pt-6">
              <h2 className="text-base font-bold text-oasis-ink">Need help signing in?</h2>
              <p className="mt-2 text-sm leading-6 text-oasis-muted">Contact your Manager or Oasis support.</p>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-oasis-border bg-white px-4 py-5 text-center text-sm text-oasis-muted">
        <p>&copy; {new Date().getFullYear()} Oasis Care</p>
      </footer>
    </div>
  );
}

function LoginLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-oasis-canvas px-4">
      <p className="text-sm font-semibold text-oasis-muted" role="status">
        Loading sign-in
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}
