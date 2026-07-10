'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useSession } from 'next-auth/react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from 'react';

import {
  createClerkClientAccessSnapshot,
  createNextAuthClientAccessSnapshot,
  type ClientAccessSnapshot,
} from '../../lib/auth/client-access';

export type GetBearerToken = () => Promise<string | null | undefined>;

export interface ClientAccessValue extends ClientAccessSnapshot {
  getBearerToken: GetBearerToken;
}

const ClientAccessContext = createContext<ClientAccessValue | null>(null);

interface Props {
  children: ReactNode;
}

export function ClerkClientAccessProvider({ children }: Props) {
  const { getToken, isLoaded, isSignedIn, orgRole } = useAuth();
  const { user } = useUser();
  const sessionClaims = useMemo(
    () => ({
      org_role: orgRole,
      public_metadata: user?.publicMetadata,
    }),
    [orgRole, user?.publicMetadata],
  );
  const snapshot = useMemo(
    () => createClerkClientAccessSnapshot({ isLoaded, isSignedIn, sessionClaims }),
    [isLoaded, isSignedIn, sessionClaims],
  );
  const getBearerToken = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return null;

    try {
      const token = await getToken();
      return typeof token === 'string' && token.trim() ? token : null;
    } catch {
      return null;
    }
  }, [getToken, isLoaded, isSignedIn]);
  const value = useMemo(
    () => ({ ...snapshot, getBearerToken }),
    [getBearerToken, snapshot],
  );

  return (
    <ClientAccessContext.Provider value={value}>
      {children}
    </ClientAccessContext.Provider>
  );
}

export function NextAuthClientAccessProvider({ children }: Props) {
  const { data: session, status } = useSession();
  const snapshot = useMemo(
    () => createNextAuthClientAccessSnapshot({
      status,
      roles: (session as any)?.roles ?? [],
    }),
    [session, status],
  );
  const getBearerToken = useCallback(async () => null, []);
  const value = useMemo(
    () => ({ ...snapshot, getBearerToken }),
    [getBearerToken, snapshot],
  );

  return (
    <ClientAccessContext.Provider value={value}>
      {children}
    </ClientAccessContext.Provider>
  );
}

export function useClientAccess(): ClientAccessValue {
  const value = useContext(ClientAccessContext);
  if (!value) {
    throw new Error('useClientAccess must be used within AppAuthProviders');
  }
  return value;
}
