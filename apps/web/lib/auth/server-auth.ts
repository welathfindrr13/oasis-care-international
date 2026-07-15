import { auth } from '@clerk/nextjs/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../app/api/auth/[...nextauth]/authOptions';
import { getBrowserClerkFixtureSession } from './clerk-browser-test-session';
import {
  AuthoritativeAccessSnapshot,
  fetchAuthoritativeAccessSnapshot,
  rolesFromAccessSnapshot,
  unauthenticatedAccessSnapshot,
  unavailableAccessSnapshot,
} from './access-snapshot';
import { resolveAuthMode, type AuthMode } from './mode';

export interface ServerAuthContext {
  authenticated: boolean;
  authMode: AuthMode;
  userId: string | null;
  organizationId: string | null;
  roles: string[];
  accessToken: string | null;
  accessSnapshot: AuthoritativeAccessSnapshot;
}

export async function getServerAuthContext(): Promise<ServerAuthContext> {
  const authMode = resolveAuthMode(process.env);
  if (authMode === 'clerk') {
    const fixtureSession = await getBrowserClerkFixtureSession();
    if (fixtureSession.userId && fixtureSession.token) {
      return buildContext(
        authMode,
        fixtureSession.userId,
        fixtureSession.token,
      );
    }
    const clerkAuth = await auth();
    let accessToken: string | null = null;
    if (clerkAuth.userId) {
      try {
        accessToken = await clerkAuth.getToken();
      } catch {
        accessToken = null;
      }
    }
    return buildContext(authMode, clerkAuth.userId, accessToken);
  }

  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken || (session as any)?.idToken || null;
  const userId = (session as any)?.user?.id || (session as any)?.user?.email || null;
  return buildContext(authMode, userId, accessToken);
}

async function buildContext(
  authMode: AuthMode,
  userId: string | null,
  accessToken: string | null,
): Promise<ServerAuthContext> {
  const providerAuthenticated = Boolean(userId);
  const accessSnapshot = !providerAuthenticated
    ? unauthenticatedAccessSnapshot()
    : accessToken
      ? await fetchAuthoritativeAccessSnapshot(accessToken)
      : unavailableAccessSnapshot();
  return {
    authenticated: providerAuthenticated,
    authMode,
    userId,
    organizationId: accessSnapshot.organizationId,
    roles: rolesFromAccessSnapshot(accessSnapshot),
    accessToken,
    accessSnapshot,
  };
}
