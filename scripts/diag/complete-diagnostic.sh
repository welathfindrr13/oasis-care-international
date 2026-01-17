#!/bin/bash
set -euo pipefail

AWS_REGION=eu-west-2
CLUSTER="oasis-care-staging-cluster"
API_SVC="oasis-api-staging"
WEB_SVC="oasis-web-staging"

echo "=== Continuing Staging Diagnostic ==="
echo "Starting at: $(date)"

# Phase 5: ALB/TG Health
echo "Phase 5: Load Balancer Health..."
aws elbv2 describe-load-balancers --region "$AWS_REGION" > _generated/diag/alb_lbs.json 2>&1 || echo '{"LoadBalancers":[]}' > _generated/diag/alb_lbs.json
aws elbv2 describe-target-groups --region "$AWS_REGION" > _generated/diag/alb_tgs.json 2>&1 || echo '{"TargetGroups":[]}' > _generated/diag/alb_tgs.json

TG_ARNs=$(jq -r '.TargetGroups[].TargetGroupArn' _generated/diag/alb_tgs.json 2>/dev/null || true)
for TG in $TG_ARNs; do
  [ -z "$TG" ] && continue
  SAFE=$(echo "$TG" | tr '/:' '__')
  aws elbv2 describe-target-health --region "$AWS_REGION" --target-group-arn "$TG" > "_generated/diag/tg_health_${SAFE}.json" 2>&1 || true
done

for LB_ARN in $(jq -r '.LoadBalancers[].LoadBalancerArn' _generated/diag/alb_lbs.json 2>/dev/null || true); do
  [ -z "$LB_ARN" ] && continue
  SAFE=$(echo "$LB_ARN" | tr '/:' '__')
  aws elbv2 describe-listeners --region "$AWS_REGION" --load-balancer-arn "$LB_ARN" > "_generated/diag/alb_listeners_${SAFE}.json" 2>&1 || true
done

# Phase 6: CloudWatch Logs (quick scan)
echo "Phase 6: CloudWatch Logs..."
for TD_FILE in _generated/diag/ecs_td_*json; do
  [ ! -f "$TD_FILE" ] && continue
  LG=$(jq -r '..|.logGroupName? // empty' "$TD_FILE" 2>/dev/null | sort -u | head -n1)
  if [ -n "$LG" ]; then
    aws logs describe-log-streams --region "$AWS_REGION" --log-group-name "$LG" --order-by LastEventTime --descending --max-items 2 > "_generated/diag/cw_streams_$(basename "$TD_FILE" .json).json" 2>&1 || true
  fi
done

# Phase 7: Secrets (names only) & IAM
echo "Phase 7: Secrets & IAM..."
LIKELY=("DATABASE_URL" "NEXTAUTH_SECRET" "NEXTAUTH_URL" "JWT_SECRET" "API_URL")
for NAME in "${LIKELY[@]}"; do
  aws secretsmanager list-secrets --region "$AWS_REGION" --filters Key=name,Values="oasis/staging/$NAME" > "_generated/diag/secret_${NAME}.json" 2>&1 || echo '{"SecretList":[]}' > "_generated/diag/secret_${NAME}.json"
done

for TD_FILE in _generated/diag/ecs_td_*json 2>/dev/null; do
  [ ! -f "$TD_FILE" ] && continue
  ROLE=$(jq -r '..|.executionRoleArn? // empty' "$TD_FILE" 2>/dev/null | head -n1)
  [ -z "$ROLE" ] && continue
  ROLE_NAME=$(basename "$ROLE")
  aws iam list-attached-role-policies --role-name "$ROLE_NAME" > "_generated/diag/iam_exec_role_${ROLE_NAME}.json" 2>&1 || true
  break
done

# Phase 8: RDS
echo "Phase 8: RDS Status..."
aws rds describe-db-instances --region "$AWS_REGION" > _generated/diag/rds_instances.json 2>&1 || echo '{"DBInstances":[]}' > _generated/diag/rds_instances.json
jq '{endpoint:.DBInstances[].Endpoint.Address, port:.DBInstances[].Endpoint.Port, id:.DBInstances[].DBInstanceIdentifier, publiclyAccessible:.DBInstances[].PubliclyAccessible}' _generated/diag/rds_instances.json > _generated/diag/rds_endpoints_compact.json 2>&1 || echo '{}' > _generated/diag/rds_endpoints_compact.json

# Phase 9: Health Endpoint Probes
echo "Phase 9: Health Probes..."
ALB_DNS=$(jq -r '.LoadBalancers[0].DNSName // empty' _generated/diag/alb_lbs.json 2>/dev/null || true)
if [ -n "$ALB_DNS" ]; then
  for P in "/" "/health" "/api/health"; do
    timeout 8 curl -sk "https://${ALB_DNS}${P}" > "_generated/diag/alb_probe_${P//\//_}.txt" 2>&1 || echo "probe failed or timeout" > "_generated/diag/alb_probe_${P//\//_}.txt"
  done
fi

echo "Diagnostic data collection complete at: $(date)"
echo "Files collected: $(ls -1 _generated/diag/ | wc -l)"
