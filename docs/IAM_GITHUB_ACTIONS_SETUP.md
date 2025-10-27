# IAM Setup for GitHub Actions - Oasis Care Staging

This guide helps verify and configure IAM permissions for the GitHub Actions deployment workflow.

## Overview

The staging deployment workflow requires specific IAM permissions to:
- Manage Terraform state (S3 + DynamoDB)
- Create/modify AWS resources (ECS, RDS, ALB, etc.)
- Manage ACM certificates
- Access Secrets Manager

## Current IAM Configuration

### Base Policy
Location: `docs/oasis-deploy-iam-policy-UPDATED.json`

This policy includes permissions for:
- EC2 (VPC, networking, security groups)
- ECS (clusters, services, tasks)
- ECR (container registries)
- RDS (database instances)
- CloudWatch (logs, alarms)
- Lambda (embedding functions)
- IAM (role management)
- ELB (load balancers, target groups)
- Route53 (DNS records)
- Secrets Manager (application secrets)
- KMS (encryption)
- ACM (SSL certificates)
- Cognito (user pool clients)
- SNS (notifications)

### S3 + DynamoDB Addon
Location: `docs/iam-s3-dynamodb-addon.json`

This addon provides Terraform backend permissions for:
- S3 bucket operations (state storage)
- DynamoDB table operations (state locking)

## Verifying GitHub Actions Role

### Option 1: AWS Console

1. Navigate to **IAM → Roles**
2. Search for the role used by GitHub Actions (typically contains "GitHub" or "OIDC")
3. Click on the role name
4. Go to **Permissions** tab
5. Verify all required policies are attached

### Option 2: AWS CLI

```bash
# List all roles and find the GitHub Actions role
aws iam list-roles --query 'Roles[?contains(RoleName, `GitHub`) || contains(RoleName, `OIDC`)].RoleName' --output table

# Once you have the role name, check its policies
ROLE_NAME="your-github-actions-role-name"

# List attached policies
aws iam list-attached-role-policies --role-name "$ROLE_NAME"

# List inline policies
aws iam list-role-policies --role-name "$ROLE_NAME"

# Get inline policy details
aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "policy-name-from-above"
```

## Common Issues & Solutions

### Issue 1: ACM Permission Errors

**Error:**
```
AccessDeniedException: not authorized to perform: acm:ListTagsForCertificate
```

**Solution:**
Ensure ACM permissions are in the GitHub Actions role (not just your user):

```bash
# Create policy document
cat > acm-addon.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "acm:RequestCertificate",
      "acm:DeleteCertificate",
      "acm:DescribeCertificate",
      "acm:ListCertificates",
      "acm:GetCertificate",
      "acm:AddTagsToCertificate",
      "acm:RemoveTagsFromCertificate",
      "acm:ListTagsForCertificate"
    ],
    "Resource": "*"
  }]
}
EOF

# Attach to GitHub Actions role
aws iam put-role-policy \
  --role-name "your-github-actions-role-name" \
  --policy-name "ACMFullAccess" \
  --policy-document file://acm-addon.json
```

### Issue 2: Missing S3/DynamoDB Permissions

**Error:**
```
Error: failed to lock state: AccessDenied: User is not authorized to perform: dynamodb:PutItem
```

**Solution:**
Apply the S3 + DynamoDB addon policy:

```bash
aws iam put-role-policy \
  --role-name "your-github-actions-role-name" \
  --policy-name "TerraformBackendAccess" \
  --policy-document file://docs/iam-s3-dynamodb-addon.json
```

### Issue 3: Secrets Manager Access Denied

**Error:**
```
AccessDeniedException: User is not authorized to perform: secretsmanager:CreateSecret
```

**Solution:**
Verify Secrets Manager permissions in the base policy:

```bash
# Check if SecretsManagerAccess is included
aws iam get-role-policy \
  --role-name "your-github-actions-role-name" \
  --policy-name "OasisDeploymentPolicy" \
  --query 'PolicyDocument.Statement[?Sid==`SecretsManagerAccess`]'
```

## Applying Policies to GitHub Actions Role

### Method 1: Inline Policy (Recommended)

```bash
# Apply base policy
aws iam put-role-policy \
  --role-name "your-github-actions-role-name" \
  --policy-name "OasisDeploymentPolicy" \
  --policy-document file://docs/oasis-deploy-iam-policy-UPDATED.json

# Apply S3/DynamoDB addon
aws iam put-role-policy \
  --role-name "your-github-actions-role-name" \
  --policy-name "TerraformBackendAccess" \
  --policy-document file://docs/iam-s3-dynamodb-addon.json
```

### Method 2: Managed Policy

```bash
# Create managed policy
aws iam create-policy \
  --policy-name "OasisStagingDeployment" \
  --policy-document file://docs/oasis-deploy-iam-policy-UPDATED.json

# Attach to role (replace ACCOUNT_ID with your AWS account ID)
aws iam attach-role-policy \
  --role-name "your-github-actions-role-name" \
  --policy-arn "arn:aws:iam::ACCOUNT_ID:policy/OasisStagingDeployment"
```

## Troubleshooting Checklist

When deployment fails with permission errors:

- [ ] Verify the error message shows the specific permission denied
- [ ] Check if the permission exists in the policy files
- [ ] Confirm the policy is attached to the GitHub Actions role (not your user)
- [ ] Verify the role ARN used in GitHub Actions secrets matches the actual role
- [ ] Wait 5-10 minutes for IAM policy changes to propagate
- [ ] Test with a new workflow run after policy changes

## Finding Your GitHub Actions Role

If you're unsure which role GitHub Actions uses:

1. Check GitHub repository secrets:
   - Repository → Settings → Secrets and variables → Actions
   - Look for `AWS_ROLE_ARN` or similar

2. Check workflow logs:
   - Actions → Latest deployment run
   - Look for "Configure AWS Credentials" step
   - The role ARN should be mentioned in the output

3. Check AWS CloudTrail:
   ```bash
   # Find recent AssumeRoleWithWebIdentity events
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
     --max-results 10
   ```

## Security Best Practices

1. **Principle of Least Privilege**: Only grant permissions actually needed
2. **Separate Roles**: Use different roles for staging vs production
3. **Regular Audits**: Review role permissions quarterly
4. **CloudTrail Logging**: Enable logging for IAM role usage
5. **Policy Versioning**: Keep old policy versions for rollback

## Next Steps

After verifying IAM setup:
1. Run the staging deployment workflow
2. Monitor for any new permission errors
3. Add missing permissions as needed
4. Document any changes made

## Support

If you encounter permission issues not covered here:
1. Check the workflow logs for the exact error message
2. Search AWS IAM documentation for the required action
3. Add the permission to the appropriate policy file
4. Reapply the policy and test again
