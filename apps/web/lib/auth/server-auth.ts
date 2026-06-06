import { auth } from '@clerk/nextjs/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '../../app/api/auth/[...nextauth]/authOptions';
import { extractClerkRolesFromClaims } from './clerk';
import { resolveAuthMode, type AuthMode } from './mode';
import { normalizeAppRoles } from './roles';

export interface ServerAuthContext {
  authenticated: boolean;
  authMode: AuthMode;
  userId: string | null;
  organizationId: string | null;
  roles: string[];
  accessToken: string | null;
}

export async function getServerAuthContext(): Promise<ServerAuthContext> {
  const authMode = resolveAuthMode(process.env);

  if (authMode === 'clerk') {
    const clerkAuth = auth();
    const accessToken = clerkAuth.userId ? await clerkAuth.getToken() : null;

    return {
      authenticated: Boolean(clerkAuth.userId && accessToken),
      authMode,
      userId: clerkAuth.userId,
      organizationId: clerkAuth.orgId || null,
      roles: extractClerkRolesFromClaims(clerkAuth.sessionClaims as Record<string, any> | null),
      accessToken,
    };
  }

  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken || (session as any)?.idToken || null;

  return {
    authenticated: Boolean(session && accessToken),
    authMode,
    userId: (session as any)?.user?.id || (session as any)?.user?.email || null,
    organizationId: (session as any)?.organizationId || null,
    roles: normalizeAppRoles((session as any)?.roles ?? []),
    accessToken,
  };
}
