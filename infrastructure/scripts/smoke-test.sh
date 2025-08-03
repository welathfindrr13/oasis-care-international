#!/usr/bin/env bash
set -euo pipefail

echo "🧪 Running smoke tests for staging API..."

cd "$(dirname "$0")/../staging"
ENDPOINT=$(terraform output -raw graphql_endpoint)

echo "Testing endpoint: $ENDPOINT"

# Test 1: Health check
echo "1️⃣ Testing health check..."
HEALTH_URL="https://staging-api.oasis-care.com/healthz"
HEALTH_RESP=$(curl -s -w "%{http_code}" -o /tmp/health_response "$HEALTH_URL")

if [ "$HEALTH_RESP" = "200" ]; then
  echo "✅ Health check passed"
  echo "Response: $(cat /tmp/health_response)"
else
  echo "❌ Health check failed with HTTP $HEALTH_RESP"
  exit 1
fi

# Test 2: GraphQL introspection
echo "2️⃣ Testing GraphQL introspection..."
RESP=$(curl -s -X POST "$ENDPOINT" \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ __typename }"}')

echo "GraphQL Response: $RESP"

if echo "$RESP" | jq -e '.data' > /dev/null 2>&1; then
  echo "✅ GraphQL endpoint responded correctly"
else
  echo "❌ GraphQL endpoint failed"
  exit 1
fi

# Test 3: GraphQL schema introspection (more detailed)
echo "3️⃣ Testing GraphQL schema..."
SCHEMA_RESP=$(curl -s -X POST "$ENDPOINT" \
  -H 'Content-Type: application/json' \
  --data '{"query":"{ __schema { types { name } } }"}')

if echo "$SCHEMA_RESP" | jq -e '.data.__schema.types' > /dev/null 2>&1; then
  echo "✅ GraphQL schema introspection works"
  TYPE_COUNT=$(echo "$SCHEMA_RESP" | jq '.data.__schema.types | length')
  echo "Found $TYPE_COUNT GraphQL types"
else
  echo "❌ GraphQL schema introspection failed"
  echo "Response: $SCHEMA_RESP"
  exit 1
fi

echo ""
echo "🎉 All smoke tests passed!"
echo "📊 Staging API is ready at: $ENDPOINT"
echo "🔍 Health check: $HEALTH_URL"

# Clean up temp files
rm -f /tmp/health_response
