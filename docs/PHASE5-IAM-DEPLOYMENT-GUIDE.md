# Phase 5 Terraform Infrastructure Deployment - IAM Policy Guide

## Status Update

**Phase 3 (Secrets Manager)**: ✅ **COMPLETE AND VALIDATED**  
The original Phase 3 Secrets Manager fix has been successfully implemented and validated across multiple deployment runs (18643275858, 18644201306, 18647197850).

**Phase 5 (Terraform Infrastructure)**: ⚠️ **REQUIRES IAM POLICY UPDATE**

## Problem Summary

The oasis-deploy user currently lacks comprehensive IAM permissions needed for full Terraform infrastructure provisioning. The latest deployment (Run 18647197850) revealed missing permissions for:

- `logs:CreateLogGroup` - CloudWatch Logs log group creation
- `iam:CreateRole` - IAM role creation for ECS tasks and Lambda functions
- `events:TagResource` - EventBridge rule tagging
- `sqs:CreateQueue` - SQS queue creation
- `ec2:CreateVpc` - VPC and network infrastructure creation

Plus a pre-existing Secrets Manager resource issue that needs lifecycle management.

## Solution: Comprehensive IAM Policy

A complete IAM policy has been created at `docs/oasis-deploy-iam-policy.json` that grants all necessary permissions for Terraform to provision the full staging infrastructure.

## Deployment Steps

### Step 1: Apply the IAM Policy

You have two options for applying the policy:

#### Option A: Update Existing Inline Policy (Recommended)

```bash
# Update the existing inline policy for oasis-deploy user
aws iam put-user-policy \
  --user-name oasis-deploy \
  --policy-name TerraformInfrastructurePolicy \
  --policy-document file://docs/oasis-deploy-iam-policy.json
```

#### Option B: Create New Managed Policy and Attach

```bash
# Create a managed policy
aws iam create-policy \
  --policy-name OasisStagingTerraformPolicy \
  --policy-document file://docs/oasis-deploy-iam-policy.json \
  --description "Comprehensive Terraform infrastructure deployment policy for Oasis Staging"

# Attach to oasis-deploy user (replace ACCOUNT_ID with your AWS account)
aws iam attach-user-policy \
  --user-name oasis-deploy \
  --policy-arn arn:aws:iam::<ACCOUNT_ID>:policy/OasisStagingTerraformPolicy
```

### Step 2: Handle Pre-existing Secrets Manager Resource

The deployment shows a `ResourceExistsException` for the `oasis/staging/DATABASE_URL` secret. This is expected as the secret was created in previous runs. You have two options:

#### Option A: Import Existing Secret into Terraform State (Recommended)

```bash
# Navigate to staging infrastructure directory
cd infrastructure/staging

# Import the existing secret
terraform import aws_secretsmanager_secret.database_url \
  arn:aws:secretsmanager:eu-west-2:721689331449:secret:oasis/staging/DATABASE_URL
```

#### Option B: Add Lifecycle Ignore to Terraform Configuration

Update `infrastructure/staging/secrets.tf`:

```hcl
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "oasis/staging/DATABASE_URL"
  description             = "Database URL for Oasis staging"
  recovery_window_in_days = 0

  tags = var.default_tags

  lifecycle {
    ignore_changes = [name]
  }
}
```

**Note**: Option A (import) is recommended as it properly manages the resource in Terraform state.

### Step 3: Re-run Terraform Deployment

After applying the IAM policy and handling the Secrets Manager resource:

```bash
# From the repository root
cd infrastructure/staging

# Initialize if needed
terraform init

# Plan to verify all permissions are present
terraform plan

# Apply the infrastructure
terraform apply
```

Or trigger via GitHub Actions (after pushing any Terraform changes):

```bash
# The deploy-staging workflow will automatically run on push to main
git add .
git commit -m "Update Terraform configuration for Phase 5 deployment"
git push origin main
```

## IAM Policy Coverage

The comprehensive policy (`docs/oasis-deploy-iam-policy.json`) includes permissions for:

### Networking (EC2)
- VPC, Subnets, Internet Gateway, NAT Gateway
- Route Tables, Security Groups
- Elastic IPs, Network Interfaces

### Compute (ECS)
- Cluster management
- Service and Task Definition management
- Container Insights

### Container Registry (ECR)
- Repository creation and management
- Image scanning and encryption
- Repository policies

### Database (RDS)
- PostgreSQL instance management
- Subnet groups
- Snapshots and backups

### Logging (CloudWatch Logs)
- Log group creation and management
- Retention policies

### Event Management (CloudWatch Events / EventBridge)
- Rule creation and management
- Target configuration
- Resource tagging

### Serverless (Lambda)
- Function creation and management
- Permission management
- VPC integration

### IAM
- Role and policy creation
- Role policy attachment
- Pass role permissions

### Messaging (SQS)
- Queue creation (standard and FIFO)
- Dead letter queues
- Queue attributes management

### Load Balancing (ALB)
- Application Load Balancer management
- Target groups and listeners
- SSL/TLS certificate management

### DNS (Route53)
- Hosted zone management
- Record set management (A, AAAA records)

### Secrets (Secrets Manager)
- Secret creation and management
- Secret value updates

### Encryption (KMS)
- Key usage for encryption/decryption
- Key description and listing

### Certificates (ACM)
- Certificate description and listing

## Verification

After deployment, verify all resources were created successfully:

```bash
# Check ECS cluster
aws ecs describe-clusters --clusters oasis-staging-cluster

# Check RDS instance
aws rds describe-db-instances --db-instance-identifier oasis-staging

# Check ALB
aws elbv2 describe-load-balancers --names oasis-staging-alb

# Check Lambda function
aws lambda get-function --function-name oasis-staging-embedding-generator

# Check SQS queues
aws sqs list-queues | grep oasis-staging

# Check CloudWatch log groups
aws logs describe-log-groups --log-group-name-prefix /ecs/oasis

# Check EventBridge rules
aws events list-rules --name-prefix oasis-staging
```

## Common Issues and Solutions

### Issue 1: Permission Still Denied After Policy Update

**Solution**: IAM changes can take up to 5 minutes to propagate. Wait a few minutes and retry.

```bash
# Force policy synchronization
aws iam get-user-policy \
  --user-name oasis-deploy \
  --policy-name TerraformInfrastructurePolicy
```

### Issue 2: Secrets Manager ResourceExistsException Persists

**Solution**: Ensure you've imported the resource or added lifecycle ignore as described in Step 2.

```bash
# Verify secret exists
aws secretsmanager describe-secret \
  --secret-id oasis/staging/DATABASE_URL

# Check Terraform state
terraform state list | grep secretsmanager
```

### Issue 3: KMS Key Not Found

**Solution**: Ensure the KMS key referenced in `variables.tf` exists:

```bash
# List KMS keys
aws kms list-aliases

# If needed, create or update the variable in terraform.tfvars
```

## Security Considerations

The IAM policy uses `"Resource": "*"` for most permissions. This is standard for Terraform deployment users but consider:

1. **For Production**: Restrict resources using specific ARN patterns:
   ```json
   "Resource": "arn:aws:ec2:eu-west-2:721689331449:vpc/*"
   ```

2. **Policy Boundaries**: Consider using IAM permission boundaries for additional safety:
   ```bash
   aws iam put-user-permissions-boundary \
     --user-name oasis-deploy \
     --permissions-boundary arn:aws:iam::aws:policy/PowerUserAccess
   ```

3. **Audit Logging**: Enable CloudTrail to monitor IAM policy usage:
   ```bash
   aws cloudtrail lookup-events --lookup-attributes \
     AttributeKey=Username,AttributeValue=oasis-deploy
   ```

## Next Steps

After successful Phase 5 deployment:

1. **Smoke Test**: Run infrastructure smoke tests
   ```bash
   ./infrastructure/scripts/smoke-test.sh
   ```

2. **Database Migration**: Apply Prisma migrations
   ```bash
   ./infrastructure/scripts/run-migration.sh
   ```

3. **Verify Services**: Check ECS services are running
   ```bash
   aws ecs describe-services \
     --cluster oasis-staging-cluster \
     --services oasis-staging-api oasis-staging-web
   ```

4. **DNS Verification**: Confirm Route53 records are resolving
   ```bash
   dig api.oasis-care.co
   dig app.oasis-care.co
   ```

## Rollback Plan

If issues arise after deployment:

```bash
# Terraform destroy (if needed)
cd infrastructure/staging
terraform destroy

# Remove IAM policy
aws iam delete-user-policy \
  --user-name oasis-deploy \
  --policy-name TerraformInfrastructurePolicy

# Restore previous policy (if backed up)
aws iam put-user-policy \
  --user-name oasis-deploy \
  --policy-name TerraformInfrastructurePolicy \
  --policy-document file://path/to/backup-policy.json
```

## References

- Terraform AWS Provider Documentation: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- AWS IAM Policy Reference: https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies.html
- Staging Deployment Report: `docs/staging-deploy-report.md`
- Phase 5 Diagnostic: `docs/infra-phase5-diagnostic.md`

## Support

For deployment issues:
1. Check GitHub Actions logs for detailed error messages
2. Review CloudWatch logs for service-level errors
3. Consult `docs/staging-deploy-report.md` for deployment history
