/**
 * Client-side GraphQL utility for use in 'use client' components
 * Uses the /api/graphql proxy to handle authentication
 */

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: {
      code?: string;
    };
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Execute GraphQL query from client components
 * Uses credentials: 'include' to forward cookies for authentication
 */
export async function clientQuery<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query, variables: variables || {} }),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 403) {
      throw new Error('Forbidden');
    }
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors && result.errors.length > 0) {
    const first = result.errors[0];
    console.error('GraphQL errors:', result.errors);
    if (first.extensions?.code === 'FORBIDDEN') {
      throw new Error('Forbidden');
    }
    if (first.extensions?.code === 'UNAUTHORIZED') {
      throw new Error('Unauthorized');
    }
    throw new Error(first.message);
  }

  if (!result.data) {
    throw new Error('No data returned from GraphQL query');
  }

  return result.data;
}
