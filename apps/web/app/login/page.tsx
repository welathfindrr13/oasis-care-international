'use client';

import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { isLocalAuthEnabled, resolveAuthMode } from '../../lib/auth/mode';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/today';
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
  const clerkSignInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;
  const [role, setRole] = useState('admin');
  const errorMessage =
    error === 'OAuthSignin'
      ? 'Authentication provider configuration is invalid. Please check the production auth provider settings.'
      : error === 'OAuthCallback'
      ? 'There was a problem signing in. Please try again.'
      : error === 'Configuration'
      ? 'Authentication is not configured correctly for this environment.'
      : error === 'CredentialsSignin'
      ? 'We could not start a local session. Please try again.'
      : error
      ? 'An error occurred. Please try again.'
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
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
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
              Private Care Management
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
                  ? 'Sign in with the configured Clerk workspace'
                  : 'Sign in to access your care command centre'}
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

            {/* Sign In Button */}
            {localAuthEnabled ? (
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Workspace</span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                  >
                    <option value="admin">Today Command Centre</option>
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
              <a
                href={clerkSignInUrl || '#'}
                aria-disabled={!clerkSignInUrl}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Continue with Clerk
              </a>
            ) : (
              <button
                onClick={() => signIn('cognito', { callbackUrl }, { prompt: 'login' })}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Sign in securely
              </button>
            )}

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-white text-slate-400 uppercase tracking-wider">
                  Secure access
                </span>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-6 text-slate-400">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <span className="text-xs">256-bit SSL</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span className="text-xs">GDPR Compliant</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-slate-400">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="py-6 text-center">
        <p className="text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Oasis Care. All rights reserved.
        </p>
      </div>
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
