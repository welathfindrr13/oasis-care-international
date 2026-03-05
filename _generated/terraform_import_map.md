# Terraform Import Map - Oasis Care Staging

**Generated:** 2025-01-25  
**Purpose:** Resolve `AlreadyExists` errors in Phase 5 deployment by importing existing AWS resources into Terraform state.

## 🚨 Critical: Run These Imports BEFORE `terraform apply`

These resources already exist in AWS (account `721689331449`, region `eu-west-2`) but are NOT in your Terraform state. Running `terraform apply` without importing them first will cause `AlreadyExists` errors.

## Import Script

Save and run this script from `infrastructure/staging/`:

```bash
#!/bin/bash
# terraform-import-all.sh
# Run this BEFORE terraform apply to import existing resources

set -e

REGION="eu-west-2"
ACCOUNT="721689331449"

echo "==== Importing existing AWS resources into Terraform state ===="
echo "Region: $REGION"
echo "Account: $ACCOUNT"
echo ""

# 1. ECR Repositories
echo "[1/15] Importing ECR repositories..."
terraform import aws_ecr_repository.api oasis-api || echo "  ⚠ oasis-api already in state or doesn't exist"
terraform import aws_ecr_repository.web oasis-web || echo "  ⚠ oasis-web already in state or doesn't exist"

# 2. ECS Cluster
echo "[2/15] Importing ECS cluster..."
terraform import aws_ecs_cluster.main oasis-care-staging-cluster || echo "  ⚠ Already in state or doesn't exist"

# 3. CloudWatch Log Groups
echo "[3/15] Importing CloudWatch log groups..."
terraform import aws_cloudwatch_log_group.api /ecs/oasis-api-staging || echo "  ⚠ Already in state"
terraform import aws_cloudwatch_log_group.web /ecs/oasis-web-staging || echo "  ⚠ Already in state"

# 4. Application Load Balancer
echo "[4/15] Importing ALB..."
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --region $REGION \
  --names oasis-care-staging-alb \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text 2>/dev/null || echo "")
if [ -n "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
  terraform import aws_lb.main "$ALB_ARN" || echo "  ⚠ Already in state"
else
  echo "  ℹ ALB not found - will be created"
fi

# 5. Target Groups
echo "[5/15] Importing target groups..."
API_TG_ARN=$(aws elbv2 describe-target-groups \
  --region $REGION \
  --names oasis-care-staging-api-tg \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text 2>/dev/null || echo "")
if [ -n "$API_TG_ARN" ] && [ "$API_TG_ARN" != "None" ]; then
  terraform import aws_lb_target_group.api "$API_TG_ARN" || echo "  ⚠ Already in state"
else
  echo "  ℹ API target group not found - will be created"
fi

WEB_TG_ARN=$(aws elbv2 describe-target-groups \
  --region $REGION \
  --names oasis-care-staging-web-tg \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text 2>/dev/null || echo "")
if [ -n "$WEB_TG_ARN" ] && [ "$WEB_TG_ARN" != "None" ]; then
  terraform import aws_lb_target_group.web "$WEB_TG_ARN" || echo "  ⚠ Already in state"
else
  echo "  ℹ Web target group not found - will be created"
fi

# 6. ALB Listeners (if ALB exists)
if [ -n "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
  echo "[6/15] Importing ALB listeners..."
  HTTP_LISTENER_ARN=$(aws elbv2 describe-listeners \
    --load-balancer-arn "$ALB_ARN" \
    --region $REGION \
    --query 'Listeners[?Port==`80`].ListenerArn | [0]' \
    --output text 2>/dev/null || echo "")
  if [ -n "$HTTP_LISTENER_ARN" ] && [ "$HTTP_LISTENER_ARN" != "None" ]; then
    terraform import aws_lb_listener.http "$HTTP_LISTENER_ARN" || echo "  ⚠ Already in state"
  fi
  
  HTTPS_LISTENER_ARN=$(aws elbv2 describe-listeners \
    --load-balancer-arn "$ALB_ARN" \
    --region $REGION \
    --query 'Listeners[?Port==`443`].ListenerArn | [0]' \
    --output text 2>/dev/null || echo "")
  if [ -n "$HTTPS_LISTENER_ARN" ] && [ "$HTTPS_LISTENER_ARN" != "None" ]; then
    terraform import aws_lb_listener.https "$HTTPS_LISTENER_ARN" || echo "  ⚠ Already in state"
  fi
else
  echo "[6/15] Skipping ALB listeners (ALB doesn't exist)"
fi

# 7. Security Groups
echo "[7/15] Importing security groups..."
ALB_SG_ID=$(aws ec2 describe-security-groups \
  --region $REGION \
  --filters "Name=group-name,Values=oasis-care-staging-alb-sg" "Name=vpc-id,Values=vpc-0fa202628a9b74522" \
  --query 'SecurityGroups[0].GroupId' \
  --output text 2>/dev/null || echo "")
if [ -n "$ALB_SG_ID" ] && [ "$ALB_SG_ID" != "None" ]; then
  terraform import aws_security_group.alb "$ALB_SG_ID" || echo "  ⚠ Already in state"
fi

ECS_SG_ID=$(aws ec2 describe-security-groups \
  --region $REGION \
  --filters "Name=group-name,Values=oasis-care-staging-ecs-sg" "Name=vpc-id,Values=vpc-0fa202628a9b74522" \
  --query 'SecurityGroups[0].GroupId' \
  --output text 2>/dev/null || echo "")
if [ -n "$ECS_SG_ID" ] && [ "$ECS_SG_ID" != "None" ]; then
  terraform import aws_security_group.ecs "$ECS_SG_ID" || echo "  ⚠ Already in state"
fi

RDS_SG_ID=$(aws ec2 describe-security-groups \
  --region $REGION \
  --filters "Name=group-name,Values=oasis-care-staging-rds-sg" "Name=vpc-id,Values=vpc-0fa202628a9b74522" \
  --query 'SecurityGroups[0].GroupId' \
  --output text 2>/dev/null || echo "")
if [ -n "$RDS_SG_ID" ] && [ "$RDS_SG_ID" != "None" ]; then
  terraform import aws_security_group.rds "$RDS_SG_ID" || echo "  ⚠ Already in state"
fi

# 8. DB Subnet Group
echo "[8/15] Importing DB subnet group..."
terraform import aws_db_subnet_group.main oasis-care-staging-db-subnet-group || echo "  ⚠ Already in state"

# 9. RDS Instance
echo "[9/15] Importing RDS instance..."
terraform import aws_db_instance.postgres oasis-staging || echo "  ⚠ Already in state"

# 10. IAM Roles
echo "[10/15] Importing IAM roles..."
terraform import aws_iam_role.ecs_task_execution oasis-care-staging-ecsTaskExec || echo "  ⚠ Already in state"
terraform import aws_iam_role.ecs_task_role oasis-care-staging-ecsTaskRole || echo "  ⚠ Already in state"
terraform import aws_iam_role.lambda_embedding_execution oasis-care-staging-lambda-embedding || echo "  ⚠ Already in state"

# 11. IAM Role Policies (inline)
echo "[11/15] Importing IAM role policies..."
terraform import aws_iam_role_policy.read_secrets oasis-care-staging-ecsTaskExec:ReadSecrets || echo "  ⚠ Already in state"
terraform import aws_iam_role_policy.bedrock_access oasis-care-staging-ecsTaskRole:BedrockAccess || echo "  ⚠ Already in state"
terraform import aws_iam_role_policy.ecs_exec oasis-care-staging-ecsTaskRole:ECSExec || echo "  ⚠ Already in state"
terraform import aws_iam_role_policy.lambda_embedding_permissions oasis-care-staging-lambda-embedding:EmbeddingPermissions || echo "  ⚠ Already in state"

# 12. IAM Role Policy Attachments
echo "[12/15] Importing IAM policy attachments..."
terraform import aws_iam_role_policy_attachment.ecs_task_exec_policy \
  oasis-care-staging-ecsTaskExec/arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy || echo "  ⚠ Already in state"
terraform import aws_iam_role_policy_attachment.lambda_basic_execution \
  oasis-care-staging-lambda-embedding/arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole || echo "  ⚠ Already in state"
terraform import aws_iam_role_policy_attachment.lambda_vpc_execution \
  oasis-care-staging-lambda-embedding/arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole || echo "  ⚠ Already in state"

# 13. ECR Repository Policies
echo "[13/15] Importing ECR repository policies..."
terraform import aws_ecr_repository_policy.api oasis-api || echo "  ⚠ Already in state"
terraform import aws_ecr_repository_policy.web oasis-web || echo "  ⚠ Already in state"

# 14. SNS Topic
echo "[14/15] Importing SNS topic..."
SNS_TOPIC_ARN="arn:aws:sns:$REGION:$ACCOUNT:oasis-care-staging-alerts"
terraform import aws_sns_topic.alerts "$SNS_TOPIC_ARN" || echo "  ⚠ Already in state or doesn't exist"

# 15. ECS Services (import last, as they depend on many other resources)
echo "[15/15] Importing ECS services..."
terraform import aws_ecs_service.api oasis-care-staging-cluster/oasis-care-staging-api || echo "  ⚠ Already in state"
terraform import aws_ecs_service.web oasis-care-staging-cluster/oasis-care-staging-web || echo "  ⚠ Already in state"

echo ""
echo "✅ Import complete!"
echo ""
echo "Next steps:"
echo "  1. Run 'terraform plan' to verify state matches reality"
echo "  2. Review any differences and fix drift"
echo "  3. Run 'terraform apply' safely"
