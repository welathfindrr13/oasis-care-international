'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';

import { clientQuery } from './client-side';

export function useClerkClientQuery() {
  const { getToken } = useAuth();

  return useCallback(
    async function queryWithClerkToken<T = any>(
      query: string,
      variables?: Record<string, any>,
    ): Promise<T> {
      return clientQuery<T>(query, variables, {
        // Clerk includes the active organization context in the session token when
        // the user has selected an organization in the browser session.
        getBearerToken: () => getToken(),
      });
    },
    [getToken],
  );
}
