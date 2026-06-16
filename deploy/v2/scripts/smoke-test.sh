#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
API_URL="${API_URL:-${BASE_URL%/}/graphql}"
TIMEOUT_SECONDS="${SMOKE_TIMEOUT_SECONDS:-15}"
ALLOW_INSECURE_TLS="${ALLOW_INSECURE_TLS:-0}"
CURL_TLS_ARGS=()

case "$(printf '%s' "$ALLOW_INSECURE_TLS" | tr '[:upper:]' '[:lower:]')" in
  1|true|yes)
    CURL_TLS_ARGS=(--insecure)
    ;;
esac

# Optional future authenticated checks. Do not print these values.
STAFF_EMAIL="${STAFF_EMAIL:-}"
STAFF_PASSWORD="${STAFF_PASSWORD:-}"
FAMILY_EMAIL="${FAMILY_EMAIL:-}"
FAMILY_PASSWORD="${FAMILY_PASSWORD:-}"
STAFF_COOKIE="${STAFF_COOKIE:-}"
FAMILY_COOKIE="${FAMILY_COOKIE:-}"
STAFF_TEST_TOKEN="${STAFF_TEST_TOKEN:-}"
FAMILY_TEST_TOKEN="${FAMILY_TEST_TOKEN:-}"

failures=0

log() {
  printf '%s\n' "$*"
}

pass() {
  log "PASS: $*"
}

skip() {
  log "SKIP: $*"
}

fail() {
  log "FAIL: $*" >&2
  failures=$((failures + 1))
}

http_status() {
  local url="$1"
  curl "${CURL_TLS_ARGS[@]}" -sS -o /tmp/oasis-smoke-response.txt -w '%{http_code}' --max-time "$TIMEOUT_SECONDS" "$url" || true
}

post_graphql() {
  local query="$1"
  local cookie="${2:-}"
  local bearer="${3:-}"
  if [[ -n "$bearer" ]]; then
    curl "${CURL_TLS_ARGS[@]}" -sS --max-time "$TIMEOUT_SECONDS" -X POST "$API_URL" \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $bearer" \
      --data "{\"query\":\"$query\"}" || true
  elif [[ -n "$cookie" ]]; then
    curl "${CURL_TLS_ARGS[@]}" -sS --max-time "$TIMEOUT_SECONDS" -X POST "$API_URL" \
      -H 'Content-Type: application/json' \
      -H "Cookie: $cookie" \
      --data "{\"query\":\"$query\"}" || true
  else
    curl "${CURL_TLS_ARGS[@]}" -sS --max-time "$TIMEOUT_SECONDS" -X POST "$API_URL" \
      -H 'Content-Type: application/json' \
      --data "{\"query\":\"$query\"}" || true
  fi
}

expect_status_class() {
  local label="$1"
  local url="$2"
  local expected_prefix="$3"
  local status
  status="$(http_status "$url")"
  if [[ "$status" == "$expected_prefix"* ]]; then
    pass "$label returned HTTP $status"
  else
    fail "$label returned HTTP $status, expected ${expected_prefix}xx"
  fi
}

expect_not_open() {
  local label="$1"
  local url="$2"
  local status
  status="$(http_status "$url")"
  case "$status" in
    200)
      fail "$label is openly accessible without authentication"
      ;;
    3*|401|403)
      pass "$label is not openly accessible without authentication (HTTP $status)"
      ;;
    *)
      fail "$label returned unexpected HTTP $status"
      ;;
  esac
}

expect_graphql_auth_safe() {
  local label="$1"
  local query="$2"
  local response
  response="$(post_graphql "$query")"

  if printf '%s' "$response" | grep -Eq '"__typename"|"errors"'; then
    pass "$label returned a GraphQL-shaped response"
  else
    fail "$label did not return a GraphQL-shaped response"
  fi
}

expect_graphql_denied_for_family_cookie() {
  local label="$1"
  local query="$2"

  if [[ -z "$FAMILY_COOKIE$FAMILY_TEST_TOKEN" ]]; then
    skip "$label requires FAMILY_COOKIE or FAMILY_TEST_TOKEN; authenticated CareBridge denial check not run"
    return
  fi

  local response
  response="$(post_graphql "$query" "$FAMILY_COOKIE" "$FAMILY_TEST_TOKEN")"

  if printf '%s' "$response" | grep -Eiq 'FORBIDDEN|UNAUTHORIZED|not authorized|Access denied'; then
    pass "$label denied family access"
  else
    fail "$label did not clearly deny family access"
  fi
}

expect_graphql_allowed_for_staff() {
  local label="$1"
  local query="$2"

  if [[ -z "$STAFF_COOKIE$STAFF_TEST_TOKEN" ]]; then
    skip "$label requires STAFF_COOKIE or STAFF_TEST_TOKEN; authenticated staff check not run"
    return
  fi

  local response
  response="$(post_graphql "$query" "$STAFF_COOKIE" "$STAFF_TEST_TOKEN")"

  if printf '%s' "$response" | grep -Eiq 'UNAUTHORIZED|FORBIDDEN|not authorized|Access denied'; then
    fail "$label did not allow staff access"
  elif printf '%s' "$response" | grep -Eq '"data"|"errors"'; then
    pass "$label returned an authenticated GraphQL response"
  else
    fail "$label did not return a GraphQL-shaped response"
  fi
}

log "Deployment V2 smoke test"
log "Base URL: $BASE_URL"
log "GraphQL URL: $API_URL"
if [[ "${#CURL_TLS_ARGS[@]}" -gt 0 ]]; then
  log "WARNING: ALLOW_INSECURE_TLS is enabled. This is for local/debug use only and is not valid HTTPS/domain proof."
fi

expect_status_class "Web login" "${BASE_URL%/}/login" "2"
expect_status_class "API health" "${BASE_URL%/}/health" "2"
expect_status_class "API readiness" "${BASE_URL%/}/ready" "2"
expect_graphql_auth_safe "GraphQL smoke" "query SmokeTypename { __typename }"

expect_not_open "Staff Today route" "${BASE_URL%/}/today"
expect_not_open "Staff Evidence route" "${BASE_URL%/}/evidence"
expect_not_open "Staff Care Planning route" "${BASE_URL%/}/care-planning"

family_status="$(http_status "${BASE_URL%/}/family")"
case "$family_status" in
  2*|3*|401|403)
    pass "Family route returns controlled HTTP $family_status"
    ;;
  *)
    fail "Family route returned unexpected HTTP $family_status"
    ;;
esac

# CareBridge is central: these probes must pass when a family session is provided.
# They protect the invariant that family users see approved projections, not raw
# operational records, medication internals, evidence packs, or staff surfaces.
expect_graphql_allowed_for_staff "Staff evidence packs GraphQL probe" "query StaffEvidencePacks { evidencePacks { id } }"
expect_graphql_denied_for_family_cookie "Family raw visits GraphQL probe" "query FamilyRawVisits { visits { id } }"
expect_graphql_denied_for_family_cookie "Family raw care notes GraphQL probe" "query FamilyRawCareLogs { careLogs { id } }"
expect_graphql_denied_for_family_cookie "Family medication administrations GraphQL probe" "query FamilyMedicationAdministrations { medicationAdministrations { id } }"
expect_graphql_denied_for_family_cookie "Family care planning GraphQL probe" "query FamilyCarePlanning { assessments { id } carePlans { id } evidencePacks { id } }"
expect_graphql_denied_for_family_cookie "Family evidence pack export source probe" "query FamilyEvidencePacks { evidencePacks { id sourceRefs { sourceType sourceId } } }"
expect_graphql_denied_for_family_cookie "Family approval queue probe" "query FamilyApprovalQueue { verifiedVisitStoryApprovalQueue { id status } }"

if [[ -n "$STAFF_EMAIL$STAFF_PASSWORD$FAMILY_EMAIL$FAMILY_PASSWORD" ]]; then
  skip "Email/password auth smoke is provider-specific and will be implemented after the production auth provider decision"
else
  skip "Authenticated staff/family checks require STAFF_TEST_TOKEN/FAMILY_TEST_TOKEN or STAFF_COOKIE/FAMILY_COOKIE from a chosen auth-provider login flow"
fi

if [[ "$failures" -gt 0 ]]; then
  log "Smoke test failed with $failures failure(s)."
  exit 1
fi

log "Smoke test completed. Authenticated CareBridge checks may be SKIPPED until session cookies or auth-provider login flow are supplied."
