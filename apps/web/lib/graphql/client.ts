import { getServerSession } from 'next-auth'
import { authOptions } from '../../app/api/auth/[...nextauth]/authOptions'

/**
 * Simple GraphQL client for server components.
 *
 * Server components should call the API directly instead of routing through the
 * app's own /api/graphql handler. In local Next dev, that self-proxy can block
 * server-rendered pages while the backend itself is healthy.
 */

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
}

/**
 * Execute a GraphQL query directly against the API from server components.
 */
export async function executeGraphQLQuery<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<GraphQLResponse<T>> {
  const request: GraphQLRequest = {
    query,
    variables: variables || {},
  };

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
    const session = await getServerSession(authOptions);
    const accessToken = (session as any)?.accessToken || (session as any)?.idToken;

    if (!accessToken) {
      throw new Error('Unauthorized');
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
      cache: 'no-store', // Always fetch fresh data
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result: GraphQLResponse<T> = await response.json();

    if (result.errors && result.errors.length > 0) {
      console.error('GraphQL errors:', result.errors);
      throw new Error(`GraphQL error: ${result.errors[0].message}`);
    }

    return result;
  } catch (error) {
    console.error('GraphQL client error:', error);
    throw error;
  }
}

/**
 * Type-safe GraphQL query execution
 */
export async function query<T = any>(
  queryString: string,
  variables?: Record<string, any>
): Promise<T> {
  const response = await executeGraphQLQuery<T>(queryString, variables);
  
  if (!response.data) {
    throw new Error('No data returned from GraphQL query');
  }

  return response.data;
}
