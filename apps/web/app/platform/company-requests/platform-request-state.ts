import { isForbiddenGraphQLRequest } from "../../../lib/graphql/client";

export type PlatformRequestFailureKind = "forbidden" | "unavailable";

export function classifyPlatformRequestFailure(
  error: unknown,
): PlatformRequestFailureKind {
  return isForbiddenGraphQLRequest(error) ? "forbidden" : "unavailable";
}
