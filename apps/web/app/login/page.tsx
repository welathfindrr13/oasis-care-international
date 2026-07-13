'use client';

import { SignIn } from '@clerk/nextjs';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { isLocalAuthEnabled, resolveAuthMode } from '../../lib/auth/mode';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/access';
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
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Logo & Branding */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl mb-6">
              <span className="text-2xl font-semibold text-white">O</span>
            </div>
            <h1 className="text-3xl font-light text-slate-900 tracking-tight">
              Oasis Care
            </h1>
            <p className="mt-2 text-slate-500 font-light">
              Care records for your organisation
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <div className="text-center mb-8">
              <h2 className="text-xl font-medium text-slate-900">
                Welcome back
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {localAuthEnabled
                  ? 'Choose a local workspace for product testing'
                  : authMode === 'clerk'
                  ? 'Sign in with your organisation account'
                  : 'Sign in to open your care workspace'}
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-800">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Sign In */}
            {localAuthEnabled ? (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Workspace</span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  >
                    <option value="admin">Manager Today</option>
                    <option value="carer">Carer workspace</option>
                    <option value="user">Family view</option>
                  </select>
                </label>

                <button
                  onClick={handleLocalSignIn}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Continue
                </button>
              </div>
            ) : authMode === 'clerk' ? (
              <div className="flex justify-center">
                <SignIn
                  routing="hash"
                  signUpUrl="/login"
                  fallbackRedirectUrl={callbackUrl}
                  appearance={{
                    elements: {
                      rootBox: 'w-full',
                      card: 'w-full border-0 shadow-none p-0',
                    },
                  }}
                />
              </div>
            ) : (
              <button
                onClick={() => signIn('cognito', { callbackUrl }, { prompt: 'login' })}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Sign in
              </button>
            )}

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-white text-slate-600 uppercase tracking-wider">
                  Organisation access
                </span>
              </div>
            </div>

            <p className="text-center text-xs leading-5 text-slate-500">
              Use the account provided by your organisation. What you can open depends on your assigned access.
            </p>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-slate-600">
            Need help signing in? Contact your Manager or Oasis support.
          </p>
        </div>
      </main>

      {/* Bottom Bar */}
      <footer className="py-6 text-center">
        <p className="text-xs text-slate-600">
          &copy; {new Date().getFullYear()} Oasis Care. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
