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

export interface ClientQueryOptions {
  getBearerToken?: () => Promise<string | null | undefined>;
  headers?: Record<string, string>;
}

/**
 * Keeps the HTTP status available to callers that need to distinguish an
 * unknown write outcome from a confirmed application-level rejection.
 */
export class ClientGraphQLHttpError extends Error {
  readonly status: number;

  constructor(status: number, statusText: string) {
    super(`GraphQL request failed: ${status} ${statusText}`);
    this.name = 'ClientGraphQLHttpError';
    this.status = status;
  }
}

type BrowserClerk = {
  load?: () => Promise<unknown>;
  session?: {
    getToken?: () => Promise<string | null | undefined>;
  } | null;
};

function getBrowserClerk(): BrowserClerk | null {
  if (typeof window === 'undefined') return null;
  return ((window as any).Clerk as BrowserClerk | undefined) || null;
}

function hasAuthorizationHeader(headers: Record<string, string>): boolean {
  return Object.entries(headers).some(
    ([key, value]) => key.toLowerCase() === 'authorization' && value.trim().length > 0,
  );
}

async function getBrowserClerkBearerToken(): Promise<string> {
  const clerk = getBrowserClerk();
  if (!clerk) return '';

  try {
    if (typeof clerk.load === 'function') {
      await clerk.load();
    }
    const token = await clerk.session?.getToken?.();
    return typeof token === 'string' ? token.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Execute GraphQL query from client components
 * Uses credentials: 'include' to forward cookies for authentication
 */
export async function clientQuery<T = any>(
  query: string,
  variables?: Record<string, any>,
  options?: ClientQueryOptions,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };
  const bearerToken = hasAuthorizationHeader(headers)
    ? ''
    : (await options?.getBearerToken?.()) || (await getBrowserClerkBearerToken());
  if (bearerToken.trim()) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  let response: Response;
  try {
    response = await fetch('/api/graphql', {
      method: 'POST',
      headers,
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
    throw new ClientGraphQLHttpError(response.status, response.statusText);
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
