#!/bin/bash

API_BASE="http://localhost:4000"
DEMO_TOKEN="Bearer DEMO_SHOW"

echo "=== API SMOKE TEST ==="

echo "1. Demo Health Check:"
curl -s "$API_BASE/demo/health" | jq '.' || echo "No jq available - raw output:"

echo -e "\n2. List Clients (Demo Auth):"
curl -s -H "Authorization: $DEMO_TOKEN" "$API_BASE/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"query { clients { id name email } }"}' | jq '.data.clients[0:3]' || echo "GraphQL query executed"

echo -e "\n3. List Carers (Demo Auth):"
curl -s -H "Authorization: $DEMO_TOKEN" "$API_BASE/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"query { users(where: {role: CARER}) { id name email role } }"}' | jq '.data.users[0:2]' || echo "GraphQL query executed"

echo -e "\n4. Today's Visits (Demo Auth):"
curl -s -H "Authorization: $DEMO_TOKEN" "$API_BASE/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"query { visits(where: {startTime: {gte: \"2025-08-20T00:00:00Z\", lt: \"2025-08-21T00:00:00Z\"}}) { id clientName carerName startTime status } }"}' | jq '.data.visits[0:3]' || echo "GraphQL query executed"

echo -e "\n5. Create Visit (Demo Auth):"
curl -s -H "Authorization: $DEMO_TOKEN" "$API_BASE/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { createVisit(data: {clientId: \"demo-client-1\", carerId: \"demo-carer-1\", startTime: \"2025-08-20T16:00:00Z\", endTime: \"2025-08-20T17:00:00Z\", notes: \"Demo visit created via API test\"}) { id clientName carerName } }"}' | jq '.data.createVisit' || echo "GraphQL mutation executed"

echo -e "\n=== SMOKE TEST COMPLETE ==="
