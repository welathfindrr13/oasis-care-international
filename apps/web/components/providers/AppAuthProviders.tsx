import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';

import { resolveAuthMode } from '../../lib/auth/mode';
import {
  ClerkClientAccessProvider,
  NextAuthClientAccessProvider,
} from './ClientAccessProvider';
import { SessionProvider } from './SessionProvider';

interface Props {
  children: ReactNode;
}

export function AppAuthProviders({ children }: Props) {
  if (resolveAuthMode(process.env) === 'clerk') {
    return (
      <ClerkProvider>
        <SessionProvider>
          <ClerkClientAccessProvider>{children}</ClerkClientAccessProvider>
        </SessionProvider>
      </ClerkProvider>
    );
  }

  return (
    <SessionProvider>
      <NextAuthClientAccessProvider>{children}</NextAuthClientAccessProvider>
    </SessionProvider>
  );
}
