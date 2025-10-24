#!/usr/bin/env bash
# Deploy latest code via Docker/ECR/ECS (bypassing Terraform)
# This script builds both API and Web images, pushes to ECR, and triggers ECS redeployment

# --- config ---
export AWS_REGION="eu-west-2"
export ACCOUNT_ID="721689331449"
export CLUSTER="oasis-care-staging-cluster"
export API_SVC="oasis-api-staging"
export WEB_SVC="oasis-web-staging"
export API_REPO="oasis-api"
export WEB_REPO="oasis-web"
export TAG="staging"
export APP_HOST="app.oasis-care.co"
export API_HOST="api.oasis-care.co"

set -euo pipefail

echo "== 0) Preflight =="
aws ecs describe-services --region "$AWS_REGION" --cluster "$CLUSTER" --services "$API_SVC" "$WEB_SVC" \
  --query 'services[].{name:serviceName,status:status,desired:desiredCount,running:runningCount}' -o table
aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$API_REPO" "$WEB_REPO" >/dev/null

echo "== 1) ECR login =="
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "== 2) Build & push API =="
# IMPORTANT: Build context must be repo root (.) because Dockerfile does COPY . .
docker build -t "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${API_REPO}:${TAG}" \
  -f apps/api/Dockerfile .
docker push "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${API_REPO}:${TAG}"

echo "== 3) Build & push WEB =="
# IMPORTANT: Build context must be repo root (.) because Dockerfile does COPY . .
docker build -t "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${WEB_REPO}:${TAG}" \
  -f apps/web/Dockerfile .
docker push "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${WEB_REPO}:${TAG}"

echo "== 4) Roll ECS services =="
aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER" --service "$API_SVC" --force-new-deployment
aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER" --service "$WEB_SVC" --force-new-deployment

echo "== 5) Wait for services to stabilize (may take 5-10 min) =="
aws ecs wait services-stable --region "$AWS_REGION" --cluster "$CLUSTER" --services "$API_SVC" "$WEB_SVC"

echo "== 6) Quick health snapshots =="
aws ecs describe-services --region "$AWS_REGION" --cluster "$CLUSTER" --services "$API_SVC" "$WEB_SVC" \
  --query 'services[].{name:serviceName,desired:desiredCount,running:runningCount}' -o table || true

echo "--- Endpoint smoke tests ---"
curl -skI --max-time 10 "https://${API_HOST}/health" | head -n1 || echo "⚠️ API health check timed out"
curl -skI --max-time 10 "https://${APP_HOST}" | head -n1 || echo "⚠️ Web app check timed out"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 To monitor logs:"
echo "  aws logs tail /ecs/oasis-api-staging --since 30m --follow"
echo "  aws logs tail /ecs/oasis-web-staging --since 30m --follow"
echo ""
echo "🌐 Live endpoints:"
echo "  API: https://${API_HOST}/health"
echo "  Web: https://${APP_HOST}"
