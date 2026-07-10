'use client';

import { useAuth } from '@clerk/nextjs';
import { useSession } from 'next-auth/react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createClientAccessSnapshot,
  loadingClientAccessSnapshot,
  type ClientAccessSnapshot,
} from '../../lib/auth/client-access';
import {
  AuthoritativeAccessSnapshot,
  unauthenticatedAccessSnapshot,
  unavailableAccessSnapshot,
} from '../../lib/auth/access-snapshot';

export type GetBearerToken = () => Promise<string | null | undefined>;
export interface ClientAccessValue extends ClientAccessSnapshot {
  getBearerToken: GetBearerToken;
}

const ClientAccessContext = createContext<ClientAccessValue | null>(null);

export function ClerkClientAccessProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn, orgId, userId } = useAuth();
  const providerStatus = !isLoaded ? 'loading' : isSignedIn ? 'authenticated' : 'unauthenticated';
  const identityKey = `${userId || ''}:${orgId || ''}`;
  const switchingAccount = useAccountSwitchBoundary(providerStatus, identityKey);
  const snapshot = useAuthoritativeBrowserSnapshot(providerStatus, identityKey);
  const getBearerToken = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return null;
    try {
      const token = await getToken();
      return typeof token === 'string' && token.trim() ? token : null;
    } catch {
      return null;
    }
  }, [getToken, isLoaded, isSignedIn]);
  const value = useMemo(() => ({ ...snapshot, getBearerToken }), [getBearerToken, snapshot]);
  return (
    <ClientAccessContext.Provider value={value}>
      {switchingAccount ? <AccountTransition /> : children}
    </ClientAccessContext.Provider>
  );
}

export function NextAuthClientAccessProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const identityKey = `${session?.user?.email || ''}:${(session as any)?.accessToken || ''}`;
  const switchingAccount = useAccountSwitchBoundary(status, identityKey);
  const snapshot = useAuthoritativeBrowserSnapshot(status, identityKey);
  const getBearerToken = useCallback(async () => null, []);
  const value = useMemo(() => ({ ...snapshot, getBearerToken }), [getBearerToken, snapshot]);
  return (
    <ClientAccessContext.Provider value={value}>
      {switchingAccount ? <AccountTransition /> : children}
    </ClientAccessContext.Provider>
  );
}

function useAccountSwitchBoundary(
  providerStatus: 'loading' | 'authenticated' | 'unauthenticated',
  identityKey: string,
): boolean {
  const [mountedIdentity, setMountedIdentity] = useState<string | null>(null);
  const switchingAccount =
    mountedIdentity !== null &&
    (providerStatus !== 'authenticated' || mountedIdentity !== identityKey);

  useEffect(() => {
    if (providerStatus === 'unauthenticated') {
      if (mountedIdentity !== null) window.location.replace('/login');
      return;
    }
    if (providerStatus !== 'authenticated') return;
    if (mountedIdentity !== null && mountedIdentity !== identityKey) {
      window.location.replace('/access');
      return;
    }
    setMountedIdentity(identityKey);
  }, [identityKey, mountedIdentity, providerStatus]);

  return switchingAccount;
}

function AccountTransition() {
  return <div className="min-h-screen bg-slate-50" aria-busy="true" aria-label="Switching account" />;
}

function useAuthoritativeBrowserSnapshot(
  providerStatus: 'loading' | 'authenticated' | 'unauthenticated',
  identityKey: string,
): ClientAccessSnapshot {
  const requestKey = `${providerStatus}:${identityKey}`;
  const loadingSnapshot = useMemo(() => loadingClientAccessSnapshot(), []);
  const [resolved, setResolved] = useState<{ key: string; snapshot: ClientAccessSnapshot }>(() => ({
    key: requestKey,
    snapshot: loadingClientAccessSnapshot(),
  }));
  const generation = useRef(0);

  useEffect(() => {
    const requestGeneration = ++generation.current;
    const controller = new AbortController();

    if (providerStatus === 'loading') {
      setResolved({ key: requestKey, snapshot: loadingClientAccessSnapshot() });
      return () => controller.abort();
    }
    if (providerStatus === 'unauthenticated') {
      setResolved({
        key: requestKey,
        snapshot: createClientAccessSnapshot('unauthenticated', unauthenticatedAccessSnapshot()),
      });
      return () => controller.abort();
    }

    setResolved({ key: requestKey, snapshot: loadingClientAccessSnapshot() });
    void fetch('/api/access-context', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const value = (await response.json().catch(() => null)) as AuthoritativeAccessSnapshot | null;
        if (requestGeneration !== generation.current) return;
        setResolved({
          key: requestKey,
          snapshot: createClientAccessSnapshot(
            'authenticated',
            response.ok && value ? value : unavailableAccessSnapshot(),
          ),
        });
      })
      .catch(() => {
        if (requestGeneration === generation.current && !controller.signal.aborted) {
          setResolved({
            key: requestKey,
            snapshot: createClientAccessSnapshot('authenticated', unavailableAccessSnapshot()),
          });
        }
      });

    return () => controller.abort();
  }, [identityKey, providerStatus, requestKey]);

  // React effects run after render. Key the resolved value so an account or
  // provider-status change cannot expose the previous account's capabilities
  // for even one render while the new snapshot request starts.
  return resolved.key === requestKey ? resolved.snapshot : loadingSnapshot;
}

export function useClientAccess(): ClientAccessValue {
  const value = useContext(ClientAccessContext);
  if (!value) throw new Error('useClientAccess must be used within AppAuthProviders');
  return value;
}
