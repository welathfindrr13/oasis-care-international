import { cookies } from 'next/headers'
import { getSiteBaseUrl } from '../url'

/**
 * Simple GraphQL client for server components
 * Uses Next.js API route proxy to handle authentication
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
 * Execute GraphQL query via Next.js API proxy
 * This ensures cookies are properly forwarded for authentication
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
    const baseUrl = getSiteBaseUrl();
    const cookie = cookies().toString();
    const response = await fetch(`${baseUrl}/api/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie
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
