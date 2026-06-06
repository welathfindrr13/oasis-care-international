import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';

import { resolveAuthMode } from '../../lib/auth/mode';
import { SessionProvider } from './SessionProvider';

interface Props {
  children: ReactNode;
}

export function AppAuthProviders({ children }: Props) {
  if (resolveAuthMode(process.env) === 'clerk') {
    return (
      <ClerkProvider>
        <SessionProvider>{children}</SessionProvider>
      </ClerkProvider>
    );
  }

  return <SessionProvider>{children}</SessionProvider>;
}
