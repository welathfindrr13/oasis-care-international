#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SMOKE_DRY_RUN="${SMOKE_DRY_RUN:-false}"
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-15}"
GRAPHQL_SCHEMA_INTROSPECTION="${GRAPHQL_SCHEMA_INTROSPECTION:-false}"
SMOKE_LIVE_OPT_IN="${SMOKE_LIVE_OPT_IN:-${ALLOW_LIVE_RELEASE_PROBES:-false}}"

trim_trailing_slash() {
  local value="$1"
  printf '%s\n' "${value%/}"
}

require_env() {
  local name="$1"
  local value="${!name:-}"

  if [[ -z "$value" ]]; then
    echo "$name is required for smoke tests; no live defaults are provided." >&2
    exit 2
  fi

  printf '%s\n' "$value"
}

resolve_graphql_endpoint() {
  if [[ -n "${GRAPHQL_ENDPOINT:-}" ]]; then
    printf '%s\n' "$GRAPHQL_ENDPOINT"
    return
  fi

  if [[ -n "${API_BASE_URL:-}" ]]; then
    printf '%s/graphql\n' "$(trim_trailing_slash "$API_BASE_URL")"
    return
  fi

  echo "GRAPHQL_ENDPOINT or API_BASE_URL is required for smoke tests; no live defaults are provided." >&2
  exit 2
}

GRAPHQL_ENDPOINT="$(resolve_graphql_endpoint)"
if [[ -z "${API_BASE_URL:-}" ]]; then
  if [[ "$GRAPHQL_ENDPOINT" == */graphql ]]; then
    API_BASE_URL="${GRAPHQL_ENDPOINT%/graphql}"
  else
    API_BASE_URL="$(require_env API_BASE_URL)"
  fi
fi
WEB_BASE_URL="$(require_env WEB_BASE_URL)"

API_BASE_URL="$(trim_trailing_slash "$API_BASE_URL")"
WEB_BASE_URL="$(trim_trailing_slash "$WEB_BASE_URL")"

API_HEALTH_PATH="${API_HEALTH_PATH:-/health}"
WEB_HEALTH_PATH="${WEB_HEALTH_PATH:-/api/health}"
API_HEALTH_URL="${API_HEALTH_URL:-${API_BASE_URL}${API_HEALTH_PATH}}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-${WEB_BASE_URL}${WEB_HEALTH_PATH}}"

print_plan() {
  echo "Smoke test plan"
  echo "GET $API_HEALTH_URL"
  echo "GET $WEB_HEALTH_URL"
  echo "POST $GRAPHQL_ENDPOINT"
  if [[ "$GRAPHQL_SCHEMA_INTROSPECTION" == "true" ]]; then
    echo "POST $GRAPHQL_ENDPOINT schema-introspection"
  fi
}

if [[ "$SMOKE_DRY_RUN" == "true" ]]; then
  print_plan
  exit 0
fi

if [[ "$SMOKE_LIVE_OPT_IN" != "true" ]]; then
  echo "SMOKE_OPT_IN_REQUIRED: set ALLOW_LIVE_RELEASE_PROBES=true or SMOKE_LIVE_OPT_IN=true to run smoke tests against explicit endpoints." >&2
  exit 2
fi

echo "Running smoke tests..."
print_plan

echo "Testing API health..."
API_HEALTH_RESPONSE="$(curl -fsS --max-time "$SMOKE_TIMEOUT_SECONDS" "$API_HEALTH_URL")"
echo "API health response: $API_HEALTH_RESPONSE"

echo "Testing web health..."
WEB_HEALTH_RESPONSE="$(curl -fsS --max-time "$SMOKE_TIMEOUT_SECONDS" "$WEB_HEALTH_URL")"
echo "Web health response: $WEB_HEALTH_RESPONSE"

echo "Testing GraphQL typename..."
GRAPHQL_RESPONSE="$(curl -fsS --max-time "$SMOKE_TIMEOUT_SECONDS" -X POST "$GRAPHQL_ENDPOINT" \
  -H 'Content-Type: application/json' \
  --data '{"query":"query SmokeTypename { __typename }"}')"

if echo "$GRAPHQL_RESPONSE" | jq -e '.data.__typename' >/dev/null 2>&1; then
  echo "GraphQL endpoint responded correctly."
else
  echo "GraphQL endpoint failed." >&2
  echo "Response: $GRAPHQL_RESPONSE" >&2
  exit 1
fi

if [[ "$GRAPHQL_SCHEMA_INTROSPECTION" == "true" ]]; then
  echo "Testing GraphQL schema introspection..."
  SCHEMA_RESPONSE="$(curl -fsS --max-time "$SMOKE_TIMEOUT_SECONDS" -X POST "$GRAPHQL_ENDPOINT" \
    -H 'Content-Type: application/json' \
    --data '{"query":"query SmokeSchema { __schema { types { name } } }"}')"

  if echo "$SCHEMA_RESPONSE" | jq -e '.data.__schema.types' >/dev/null 2>&1; then
    TYPE_COUNT="$(echo "$SCHEMA_RESPONSE" | jq '.data.__schema.types | length')"
    echo "GraphQL schema introspection works. Found $TYPE_COUNT GraphQL types."
  else
    echo "GraphQL schema introspection failed." >&2
    echo "Response: $SCHEMA_RESPONSE" >&2
    exit 1
  fi
fi

echo "All smoke tests passed."
