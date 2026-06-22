#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${TERRAFORM_DIR:-${SCRIPT_DIR}/../staging}"

AWS_REGION="${AWS_REGION:-eu-west-2}"
CLUSTER="${CLUSTER:-oasis-care-staging-cluster}"
TASK_DEF="${TASK_DEF:-oasis-care-staging-api}"
CONTAINER_NAME="${CONTAINER_NAME:-api}"
EXPECTED_AWS_ACCOUNT_ID="${EXPECTED_AWS_ACCOUNT_ID:-${AWS_ACCOUNT_ID:-}}"
MIGRATION_DRY_RUN="${MIGRATION_DRY_RUN:-false}"
MIGRATION_COMMAND=(npx prisma migrate deploy)

resolve_subnet_id() {
  if [[ -n "${SUBNET_ID:-}" ]]; then
    printf '%s\n' "$SUBNET_ID"
    return
  fi

  terraform -chdir="$TERRAFORM_DIR" output -json private_subnet_ids | jq -r '.[0]'
}

resolve_security_group_id() {
  if [[ -n "${SECURITY_GROUP_ID:-}" ]]; then
    printf '%s\n' "$SECURITY_GROUP_ID"
    return
  fi

  terraform -chdir="$TERRAFORM_DIR" output -raw ecs_security_group_id
}

print_plan() {
  local subnet_label="${SUBNET_ID:-<terraform private_subnet_ids[0]>}"
  local security_group_label="${SECURITY_GROUP_ID:-<terraform ecs_security_group_id>}"

  echo "Migration plan"
  echo "region: $AWS_REGION"
  echo "expected account: ${EXPECTED_AWS_ACCOUNT_ID:-<not enforced>}"
  echo "cluster: $CLUSTER"
  echo "task definition: $TASK_DEF"
  echo "container: $CONTAINER_NAME"
  echo "subnet: $subnet_label"
  echo "security group: $security_group_label"
  echo "command: ${MIGRATION_COMMAND[*]}"
}

if [[ "$MIGRATION_DRY_RUN" == "true" ]]; then
  print_plan
  exit 0
fi

echo "Running database migrations..."
print_plan

if [[ -z "$EXPECTED_AWS_ACCOUNT_ID" ]]; then
  echo "EXPECTED_AWS_ACCOUNT_ID is required for non-dry-run migrations." >&2
  exit 2
fi

account="$(aws sts get-caller-identity --region "$AWS_REGION" --query Account --output text)"
if [[ "$account" != "$EXPECTED_AWS_ACCOUNT_ID" ]]; then
  echo "Unexpected AWS account: $account (expected $EXPECTED_AWS_ACCOUNT_ID)" >&2
  exit 1
fi

SUBNET1="$(resolve_subnet_id)"
SEC_GRP="$(resolve_security_group_id)"

if [[ -z "$SUBNET1" || "$SUBNET1" == "null" ]]; then
  echo "Could not resolve subnet ID. Set SUBNET_ID or check Terraform output private_subnet_ids." >&2
  exit 1
fi

if [[ -z "$SEC_GRP" || "$SEC_GRP" == "null" ]]; then
  echo "Could not resolve ECS security group ID. Set SECURITY_GROUP_ID or check Terraform output ecs_security_group_id." >&2
  exit 1
fi

OVERRIDES="$(jq -cn --arg name "$CONTAINER_NAME" '{containerOverrides:[{name:$name,command:["npx","prisma","migrate","deploy"]}]}')"

echo "Starting migration task..."
TASK_ARN="$(aws ecs run-task \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER" \
  --launch-type FARGATE \
  --task-definition "$TASK_DEF" \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET1],securityGroups=[$SEC_GRP],assignPublicIp=DISABLED}" \
  --overrides "$OVERRIDES" \
  --query 'tasks[0].taskArn' \
  --output text)"

if [[ -z "$TASK_ARN" || "$TASK_ARN" == "None" || "$TASK_ARN" == "null" ]]; then
  echo "Migration task did not start. Check ECS run-task output and CloudWatch logs." >&2
  exit 1
fi

echo "Migration task started: $TASK_ARN"
echo "Waiting for migration to complete..."
aws ecs wait tasks-stopped --region "$AWS_REGION" --cluster "$CLUSTER" --tasks "$TASK_ARN"

EXIT_CODE="$(aws ecs describe-tasks \
  --region "$AWS_REGION" \
  --cluster "$CLUSTER" \
  --tasks "$TASK_ARN" \
  --query "tasks[0].containers[?name=='${CONTAINER_NAME}'].exitCode | [0]" \
  --output text)"

if [[ "$EXIT_CODE" == "0" ]]; then
  echo "Migration completed successfully."
else
  echo "Migration failed with exit code: $EXIT_CODE" >&2
  echo "Task ARN: $TASK_ARN" >&2
  exit 1
fi
