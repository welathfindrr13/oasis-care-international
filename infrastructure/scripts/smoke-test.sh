#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${TERRAFORM_DIR:-${SCRIPT_DIR}/../staging}"

SMOKE_DRY_RUN="${SMOKE_DRY_RUN:-false}"
SMOKE_TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-15}"
GRAPHQL_SCHEMA_INTROSPECTION="${GRAPHQL_SCHEMA_INTROSPECTION:-false}"

trim_trailing_slash() {
  local value="$1"
  printf '%s\n' "${value%/}"
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

  if [[ -d "$TERRAFORM_DIR" ]]; then
    terraform -chdir="$TERRAFORM_DIR" output -raw graphql_endpoint 2>/dev/null && return
  fi

  printf '%s\n' "https://api.oasis-care.co/graphql"
}

GRAPHQL_ENDPOINT="$(resolve_graphql_endpoint)"
API_BASE_URL="${API_BASE_URL:-${GRAPHQL_ENDPOINT%/graphql}}"
WEB_BASE_URL="${WEB_BASE_URL:-https://app.oasis-care.co}"

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
