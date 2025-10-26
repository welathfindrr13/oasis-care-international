#!/bin/bash
set -euo pipefail

# Cleanup script for misplaced ALB and Target Groups
# These resources were created in wrong VPCs during failed deployments

AWS_REGION="${AWS_REGION:-eu-west-2}"

echo "🧹 Cleaning up misplaced ALB and Target Groups..."
echo "Region: $AWS_REGION"
echo ""

# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names "oasis-care-staging-alb" \
  --region "$AWS_REGION" \
  --query "LoadBalancers[0].LoadBalancerArn" \
  --output text 2>/dev/null || echo "")

if [ -n "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
  echo "Found ALB: $ALB_ARN"
  echo "VPC: $(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --region "$AWS_REGION" --query "LoadBalancers[0].VpcId" --output text)"
  
  echo "Deleting ALB..."
  aws elbv2 delete-load-balancer \
    --load-balancer-arn "$ALB_ARN" \
    --region "$AWS_REGION"
  echo "✅ ALB deleted"
  
  # Wait for deletion to complete
  echo "Waiting for ALB deletion to complete..."
  sleep 10
else
  echo "⚠️  ALB not found (may already be deleted)"
fi

echo ""

# Delete Target Groups
for TG_NAME in "oasis-care-staging-api-tg" "oasis-care-staging-web-tg"; do
  TG_ARN=$(aws elbv2 describe-target-groups \
    --names "$TG_NAME" \
    --region "$AWS_REGION" \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$TG_ARN" ] && [ "$TG_ARN" != "None" ]; then
    echo "Found Target Group: $TG_NAME"
    echo "ARN: $TG_ARN"
    echo "VPC: $(aws elbv2 describe-target-groups --target-group-arns "$TG_ARN" --region "$AWS_REGION" --query "TargetGroups[0].VpcId" --output text)"
    
    echo "Deleting Target Group..."
    aws elbv2 delete-target-group \
      --target-group-arn "$TG_ARN" \
      --region "$AWS_REGION"
    echo "✅ Target Group deleted: $TG_NAME"
  else
    echo "⚠️  Target Group not found: $TG_NAME (may already be deleted)"
  fi
  echo ""
done

echo ""
echo "🎉 Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Verify alb.tf has target_type = 'ip' for both target groups"
echo "2. Run: git add infrastructure/staging/alb.tf"
echo "3. Run: git commit -m 'fix: Add target_type=ip for Fargate'"
echo "4. Run: git push"
echo "5. Monitor GitHub Actions for successful deployment"
