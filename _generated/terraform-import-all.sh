#!/bin/bash
set -euo pipefail

# Terraform Import Script for Oasis Staging Infrastructure
# Auto-discovers AWS resources and imports them into Terraform state
# Usage: Run from infrastructure/staging directory after terraform init

echo "=========================================="
echo "Terraform Import Script - Oasis Staging"
echo "=========================================="
echo ""

REGION="${AWS_REGION:-eu-west-2}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")

if [ -z "$ACCOUNT_ID" ]; then
  echo "❌ ERROR: Cannot determine AWS account ID. Check AWS credentials."
  exit 1
fi

echo "AWS Account: $ACCOUNT_ID"
echo "AWS Region: $REGION"
echo ""

# Counter for tracking imports
IMPORTED=0
SKIPPED=0
FAILED=0

# Helper function to import resource if not already in state
import_if_missing() {
  local tf_address="$1"
  local resource_id="$2"
  local resource_name="$3"
  
  # Check if already in state
  if terraform state list 2>/dev/null | grep -qx "$tf_address"; then
    echo "  ⏭️  SKIP: $resource_name (already in state)"
    ((SKIPPED++))
    return 0
  fi
  
  # Check if resource exists in AWS
  if [ -z "$resource_id" ] || [ "$resource_id" = "None" ] || [ "$resource_id" = "null" ]; then
    echo "  ⚠️  SKIP: $resource_name (does not exist in AWS)"
    ((SKIPPED++))
    return 0
  fi
  
  # Attempt import
  echo "  🔄 IMPORTING: $resource_name"
  echo "     Address: $tf_address"
  echo "     ID: $resource_id"
  
  if terraform import -input=false "$tf_address" "$resource_id" 2>&1 | tee /tmp/tf-import.log | grep -q "Import successful"; then
    echo "  ✅ SUCCESS: $resource_name imported"
    ((IMPORTED++))
    return 0
  else
    echo "  ❌ FAILED: $resource_name import failed"
    cat /tmp/tf-import.log | tail -5
    ((FAILED++))
    return 1
  fi
}

echo "=== Phase 1: Discovering AWS Resources ==="
echo ""

# ECR Repositories
echo "📦 ECR Repositories:"
API_ECR=$(aws ecr describe-repositories --repository-names "oasis-api" --region "$REGION" \
  --query 'repositories[0].repositoryName' --output text 2>/dev/null || echo "")
WEB_ECR=$(aws ecr describe-repositories --repository-names "oasis-web" --region "$REGION" \
  --query 'repositories[0].repositoryName' --output text 2>/dev/null || echo "")

echo "  - oasis-api: ${API_ECR:-NOT FOUND}"
echo "  - oasis-web: ${WEB_ECR:-NOT FOUND}"
echo ""

# CloudWatch Log Groups
echo "📊 CloudWatch Log Groups:"
API_LOG=$(aws logs describe-log-groups --log-group-name-prefix "/ecs/oasis-api-staging" --region "$REGION" \
  --query 'logGroups[0].logGroupName' --output text 2>/dev/null || echo "")
WEB_LOG=$(aws logs describe-log-groups --log-group-name-prefix "/ecs/oasis-web-staging" --region "$REGION" \
  --query 'logGroups[0].logGroupName' --output text 2>/dev/null || echo "")

echo "  - API: ${API_LOG:-NOT FOUND}"
echo "  - Web: ${WEB_LOG:-NOT FOUND}"
echo ""

# IAM Roles
echo "👤 IAM Roles:"
TASK_EXEC_ROLE=$(aws iam get-role --role-name "oasis-care-staging-ecsTaskExec" --region "$REGION" \
  --query 'Role.RoleName' --output text 2>/dev/null || echo "")
TASK_ROLE=$(aws iam get-role --role-name "oasis-care-staging-ecsTaskRole" --region "$REGION" \
  --query 'Role.RoleName' --output text 2>/dev/null || echo "")
LAMBDA_ROLE=$(aws iam get-role --role-name "oasis-care-staging-lambda-embedding" --region "$REGION" \
  --query 'Role.RoleName' --output text 2>/dev/null || echo "")

echo "  - ECS Task Execution: ${TASK_EXEC_ROLE:-NOT FOUND}"
echo "  - ECS Task Role: ${TASK_ROLE:-NOT FOUND}"
echo "  - Lambda Embedding: ${LAMBDA_ROLE:-NOT FOUND}"
echo ""

# Secrets Manager - Need full ARN
echo "🔐 Secrets Manager:"
DB_SECRET_ARN=$(aws secretsmanager list-secrets --region "$REGION" \
  --query "SecretList[?Name=='oasis/staging/DATABASE_URL'].ARN" --output text 2>/dev/null || echo "")

if [ -n "$DB_SECRET_ARN" ] && [ "$DB_SECRET_ARN" != "None" ]; then
  echo "  - DATABASE_URL: Found (${DB_SECRET_ARN})"
else
  echo "  - DATABASE_URL: NOT FOUND"
fi
echo ""

# RDS DB Subnet Group
echo "🗄️ RDS Resources:"
DB_SUBNET_GROUP=$(aws rds describe-db-subnet-groups --db-subnet-group-name "oasis-care-staging-db-subnet-group" --region "$REGION" \
  --query 'DBSubnetGroups[0].DBSubnetGroupName' --output text 2>/dev/null || echo "")

echo "  - DB Subnet Group: ${DB_SUBNET_GROUP:-NOT FOUND}"
echo ""

# Security Groups
echo "🔒 Security Groups:"
ALB_SG=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=oasis-care-staging-alb-sg" --region "$REGION" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "")

echo "  - ALB Security Group: ${ALB_SG:-NOT FOUND}"
echo ""

# ALB and Target Groups
echo "⚖️ Load Balancer Resources:"
ALB_ARN=$(aws elbv2 describe-load-balancers --names "oasis-care-staging-alb" --region "$REGION" \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || echo "")
API_TG_ARN=$(aws elbv2 describe-target-groups --names "oasis-care-staging-api-tg" --region "$REGION" \
  --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")
WEB_TG_ARN=$(aws elbv2 describe-target-groups --names "oasis-care-staging-web-tg" --region "$REGION" \
  --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")

if [ -n "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
  echo "  - ALB: Found"
else
  echo "  - ALB: NOT FOUND"
fi

if [ -n "$API_TG_ARN" ] && [ "$API_TG_ARN" != "None" ]; then
  echo "  - API Target Group: Found"
else
  echo "  - API Target Group: NOT FOUND"
fi

if [ -n "$WEB_TG_ARN" ] && [ "$WEB_TG_ARN" != "None" ]; then
  echo "  - Web Target Group: Found"
else
  echo "  - Web Target Group: NOT FOUND"
fi
echo ""

echo "=== Phase 2: Importing Resources into Terraform State ==="
echo ""

# Import ECR repositories
if [ -n "$API_ECR" ]; then
  import_if_missing "aws_ecr_repository.api" "$API_ECR" "ECR Repository: oasis-api" || true
fi

if [ -n "$WEB_ECR" ]; then
  import_if_missing "aws_ecr_repository.web" "$WEB_ECR" "ECR Repository: oasis-web" || true
fi

# Import CloudWatch Log Groups
if [ -n "$API_LOG" ]; then
  import_if_missing "aws_cloudwatch_log_group.api" "$API_LOG" "CloudWatch Log Group: API" || true
fi

if [ -n "$WEB_LOG" ]; then
  import_if_missing "aws_cloudwatch_log_group.web" "$WEB_LOG" "CloudWatch Log Group: Web" || true
fi

# Import IAM Roles
if [ -n "$TASK_EXEC_ROLE" ]; then
  import_if_missing "aws_iam_role.ecs_task_execution" "$TASK_EXEC_ROLE" "IAM Role: ECS Task Execution" || true
fi

if [ -n "$TASK_ROLE" ]; then
  import_if_missing "aws_iam_role.ecs_task_role" "$TASK_ROLE" "IAM Role: ECS Task" || true
fi

if [ -n "$LAMBDA_ROLE" ]; then
  import_if_missing "aws_iam_role.lambda_embedding_execution" "$LAMBDA_ROLE" "IAM Role: Lambda Embedding" || true
fi

# Import Secrets Manager secret (using ARN)
if [ -n "$DB_SECRET_ARN" ] && [ "$DB_SECRET_ARN" != "None" ]; then
  import_if_missing "aws_secretsmanager_secret.database_url" "$DB_SECRET_ARN" "Secrets Manager: DATABASE_URL" || true
fi

# Import Security Group
if [ -n "$ALB_SG" ] && [ "$ALB_SG" != "None" ]; then
  import_if_missing "aws_security_group.alb" "$ALB_SG" "ALB Security Group" || true
fi

# Import RDS DB Subnet Group
if [ -n "$DB_SUBNET_GROUP" ]; then
  import_if_missing "aws_db_subnet_group.main" "$DB_SUBNET_GROUP" "RDS DB Subnet Group" || true
fi

# Import ALB and Target Groups (only if they exist)
if [ -n "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
  import_if_missing "aws_lb.main" "$ALB_ARN" "Application Load Balancer" || true
fi

if [ -n "$API_TG_ARN" ] && [ "$API_TG_ARN" != "None" ]; then
  import_if_missing "aws_lb_target_group.api" "$API_TG_ARN" "Target Group: API" || true
fi

if [ -n "$WEB_TG_ARN" ] && [ "$WEB_TG_ARN" != "None" ]; then
  import_if_missing "aws_lb_target_group.web" "$WEB_TG_ARN" "Target Group: Web" || true
fi

echo ""
echo "=== Import Summary ==="
echo "✅ Successfully Imported: $IMPORTED"
echo "⏭️  Skipped (already in state or not found): $SKIPPED"
echo "❌ Failed: $FAILED"
echo ""

echo "=== Current Terraform State ==="
terraform state list 2>/dev/null || echo "(State is empty or inaccessible)"
echo ""

if [ $IMPORTED -gt 0 ]; then
  echo "✅ Import process completed successfully!"
  echo "   $IMPORTED resources were imported into Terraform state."
else
  echo "⚠️  No new resources were imported."
  echo "   All resources may already be in state, or they don't exist in AWS yet."
fi

exit 0
