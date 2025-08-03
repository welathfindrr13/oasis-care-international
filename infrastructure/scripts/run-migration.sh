#!/usr/bin/env bash
set -euo pipefail

echo "🗃️ Running database migrations..."

CLUSTER="oasis-care-staging-cluster"
TASK_DEF="oasis-care-staging-api"

# Get the infrastructure outputs
cd "$(dirname "$0")/../staging"
SUBNET1=$(terraform output -raw private_subnet_ids | jq -r '.[0]')
SEC_GRP=$(terraform output -raw ecs_security_group_id)

echo "Using subnet: $SUBNET1"
echo "Using security group: $SEC_GRP"

# Run migration task
echo "🚀 Starting migration task..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --launch-type FARGATE \
  --task-definition "$TASK_DEF" \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET1],securityGroups=[$SEC_GRP],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"api","command":["npx","prisma","migrate","deploy"]}]}' \
  --query 'tasks[0].taskArn' \
  --output text)

echo "Migration task started: $TASK_ARN"

# Wait for task to complete
echo "⏳ Waiting for migration to complete..."
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ARN"

# Get exit code
EXIT_CODE=$(aws ecs describe-tasks \
  --cluster "$CLUSTER" \
  --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' \
  --output text)

if [ "$EXIT_CODE" = "0" ]; then
  echo "✅ Migration completed successfully!"
else
  echo "❌ Migration failed with exit code: $EXIT_CODE"
  echo "Check CloudWatch logs for details: /ecs/oasis-care-staging"
  exit 1
fi
