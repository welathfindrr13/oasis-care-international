import { getServerAuthContext } from "../auth/server-auth";

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
    extensions?: {
      code?: string;
    };
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
  }>;
}

export class GraphQLRequestError extends Error {
  readonly code: string | null;

  constructor(message: string, code?: string | null) {
    super(message);
    this.name = "GraphQLRequestError";
    this.code = typeof code === "string" && code.trim() ? code.trim() : null;
  }
}

export function isForbiddenGraphQLRequest(error: unknown): boolean {
  return (
    error instanceof GraphQLRequestError &&
    error.code?.toUpperCase() === "FORBIDDEN"
  );
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
  variables?: Record<string, any>,
): Promise<GraphQLResponse<T>> {
  const request: GraphQLRequest = {
    query,
    variables: variables || {},
  };

  try {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/graphql";
    const { accessToken } = await getServerAuthContext();

    if (!accessToken) {
      throw new Error("Unauthorized");
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
      cache: "no-store", // Always fetch fresh data
    });

    if (!response.ok) {
      throw new GraphQLRequestError(
        `GraphQL request failed: ${response.status} ${response.statusText}`,
        response.status === 403 ? "FORBIDDEN" : null,
      );
    }

    const result: GraphQLResponse<T> = await response.json();

    if (result.errors && result.errors.length > 0) {
      console.error("GraphQL errors:", result.errors);
      throw new GraphQLRequestError(
        `GraphQL error: ${result.errors[0].message}`,
        result.errors[0].extensions?.code,
      );
    }

    return result;
  } catch (error) {
    console.error("GraphQL client error:", error);
    throw error;
  }
}

/**
 * Type-safe GraphQL query execution
 */
export async function query<T = any>(
  queryString: string,
  variables?: Record<string, any>,
): Promise<T> {
  const response = await executeGraphQLQuery<T>(queryString, variables);

  if (!response.data) {
    throw new Error("No data returned from GraphQL query");
  }

  return response.data;
}
