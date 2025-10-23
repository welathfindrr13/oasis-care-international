#!/bin/bash
set -e
echo "🔧 Fixing Terraform state drift for Oasis staging..."
echo ""

cd "/Users/tyreeseedwards/oasis international care/infrastructure/staging"

echo "🔍 Auto-discovering AWS resource IDs..."
# Fetch real Route53 Zone ID
ROUTE53_ZONE=$(aws route53 list-hosted-zones-by-name --dns-name oasis-care.co --query "HostedZones[0].Id" --output text | sed 's|/hostedzone/||')
echo "  Route53 Zone ID: $ROUTE53_ZONE"

# Fetch real ACM certificate ARNs
APP_CERT=$(aws acm list-certificates --region eu-west-2 --query "CertificateSummaryList[?DomainName=='app.oasis-care.co'].CertificateArn | [0]" --output text)
API_CERT=$(aws acm list-certificates --region eu-west-2 --query "CertificateSummaryList[?DomainName=='api.oasis-care.co'].CertificateArn | [0]" --output text)
echo "  App Cert ARN: $APP_CERT"
echo "  API Cert ARN: $API_CERT"

# Set all required TF variables as environment variables
export TF_VAR_project="oasis-care"
export TF_VAR_environment="staging"
export TF_VAR_aws_region="eu-west-2"
export TF_VAR_api_domain="api.oasis-care.co"
export TF_VAR_web_domain="app.oasis-care.co"
export TF_VAR_route53_zone_id="$ROUTE53_ZONE"
export TF_VAR_app_cert_arn="$APP_CERT"
export TF_VAR_api_cert_arn="$API_CERT"
export TF_VAR_kms_key_id="8995c5be-616f-4680-953e-8ed3b7252689"
export TF_VAR_sns_topic_arn="arn:aws:sns:eu-west-2:721689331449:oasis-staging-alerts"
export TF_VAR_db_username="oasis"
export TF_VAR_db_instance_class="db.t3.micro"
export TF_VAR_frontend_url="https://app.oasis-care.co"
export TF_VAR_ai_summary_enabled="true"

echo ""
echo "📋 Step 1: Initialize Terraform..."
terraform init -input=false

echo ""
echo "📦 Step 2: Importing existing AWS resources into Terraform state..."
echo "This is safe to re-run - already imported resources will be skipped."
echo ""

# Import ECR repositories  
echo "→ Importing ECR repositories..."
terraform import -input=false aws_ecr_repository.api oasis-api 2>/dev/null || echo "  (already imported or doesn't exist)"
terraform import -input=false aws_ecr_repository.web oasis-web 2>/dev/null || echo "  (already imported or doesn't exist)"

# Import CloudWatch log groups
echo "→ Importing CloudWatch log groups..."
terraform import -input=false aws_cloudwatch_log_group.api "/ecs/oasis-api-staging" 2>/dev/null || echo "  (already imported or doesn't exist)"
terraform import -input=false aws_cloudwatch_log_group.web "/ecs/oasis-web-staging" 2>/dev/null || echo "  (already imported or doesn't exist)"

# Import IAM roles
echo "→ Importing IAM roles..."
terraform import -input=false aws_iam_role.ecs_task_execution oasis-care-staging-ecsTaskExec 2>/dev/null || echo "  (already imported or doesn't exist)"
terraform import -input=false aws_iam_role.ecs_task_role oasis-care-staging-ecsTaskRole 2>/dev/null || echo "  (already imported or doesn't exist)"
terraform import -input=false aws_iam_role.lambda_embedding_execution oasis-care-staging-lambda-embedding 2>/dev/null || echo "  (already imported or doesn't exist)"

# Import Secrets Manager secret
echo "→ Importing Secrets Manager secret..."
terraform import -input=false aws_secretsmanager_secret.database_url oasis/staging/DATABASE_URL 2>/dev/null || echo "  (already imported or doesn't exist)"

echo ""
echo "✅ Import phase complete!"
echo ""

echo "🧹 Step 3: Formatting and validation..."
terraform fmt -recursive
terraform validate

echo ""
echo "📊 Step 4: Running terraform plan..."
terraform plan -input=false -out=tfplan

echo ""
echo "✅ Fix complete! Review the plan above."
echo "To apply: cd infrastructure/staging && terraform apply tfplan"
