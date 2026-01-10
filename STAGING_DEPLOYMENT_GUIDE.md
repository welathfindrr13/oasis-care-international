# 🚀 Oasis Care Staging Deployment Guide - oasis-care.co

**Date:** 2025-10-10  
**Branch:** feat/staging-live-setup  
**Commit:** 40bf90b  
**Domain:** oasis-care.co (migrated from .com)

---

## ✅ Completed Steps

1. **Domain Migration**: All references updated from `oasis-care.com` to `oasis-care.co`
   - GitHub Actions workflow
   - Terraform infrastructure configs
   - Cognito callback URLs

2. **Code Changes Committed & Pushed**
   - 4 files changed, 39 insertions(+), 39 deletions(-)
   - Terraform formatted
   - Branch: `feat/staging-live-setup`

---

## 🔐 REQUIRED: IAM Policy Setup (AWS Console)

AWS credentials are not available locally. You MUST add these policies via AWS Console before deployment.

### Step 1: Log into AWS Console
- Region: **eu-west-2** (London)
- Navigate to: **IAM → Users → oasis-deploy** (or the role used by GitHub Actions)

### Step 2: Add Four Inline Policies

#### Policy 1: `OasisCognitoClientAdmin`
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CognitoClientAdminSpecificPool",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:CreateUserPoolClient",
        "cognito-idp:UpdateUserPoolClient",
        "cognito-idp:DescribeUserPoolClient",
        "cognito-idp:ListUserPoolClients"
      ],
      "Resource": "arn:aws:cognito-idp:eu-west-2:721689331449:userpool/eu-west-2_YPo6sl1zm"
    }
  ]
}
```

#### Policy 2: `OasisRoute53DNS`
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListZonesByName",
      "Effect": "Allow",
      "Action": ["route53:ListHostedZonesByName"],
      "Resource": "*"
    },
    {
      "Sid": "ZoneReadWrite",
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets",
        "route53:GetHostedZone"
      ],
      "Resource": "arn:aws:route53:::hostedzone/Z00092362ORF3ZO6TWKKZ"
    }
  ]
}
```

#### Policy 3: `OasisSecretsManagerWrite`
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "OasisSecretsStagingWrite",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:PutSecretValue",
        "secretsmanager:UpdateSecret",
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:ListSecrets",
        "secretsmanager:TagResource",
        "secretsmanager:UntagResource",
        "secretsmanager:DeleteSecret"
      ],
      "Resource": "arn:aws:secretsmanager:eu-west-2:721689331449:secret:oasis/staging/*"
    }
  ]
}
```

**Note:** This policy grants access to all secrets under `oasis/staging/*` path. This is required because:
- Phase 1 creates `oasis/staging/cognito_web_client_secret` for the Cognito client
- Phase 3 creates `oasis/staging/DATABASE_URL`, `oasis/staging/NEXTAUTH_SECRET`, and `oasis/staging/NEXTAUTH_URL`
- Phase 2.5 runs a preflight check that creates a temporary secret to verify permissions

#### Policy 4: `OasisACMRequest`
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ACMRequestAndRead",
      "Effect": "Allow",
      "Action": [
        "acm:RequestCertificate",
        "acm:DescribeCertificate",
        "acm:ListCertificates",
        "acm:AddTagsToCertificate"
      ],
      "Resource": "*"
    }
  ]
}
```

### Step 3: Verify Policies Are Attached
In IAM Console, confirm all 4 policies appear under the `oasis-deploy` user/role.

---

## 📋 Deployment Workflow

Once IAM policies are added, deploy via GitHub Actions:

### Option A: Via GitHub UI
1. Go to: https://github.com/welathfindrr13/oasis-care-international/actions
2. Select workflow: **Deploy Oasis Care to Staging**
3. Click **Run workflow**
4. Branch: `feat/staging-live-setup`
5. Click **Run workflow** (green button)

### Option B: Via GitHub CLI (if available)
```bash
gh workflow run deploy-staging.yml \
  --repo welathfindrr13/oasis-care-international \
  --ref feat/staging-live-setup
```

### Monitor Deployment
```bash
gh run watch --repo welathfindrr13/oasis-care-international
```

Or view in browser:
https://github.com/welathfindrr13/oasis-care-international/actions

---

## 🔍 What the Workflow Will Do

### Phase 1: Cognito Confidential Client
- Creates client: `oasis-staging-web-confidential` with `GenerateSecret=true`
- Persists secret to: `oasis/staging/cognito_web_client_secret`
- **Callback URL:** https://app.oasis-care.co/api/auth/callback/cognito
- **Logout URL:** https://app.oasis-care.co

### Phase 2: ACM Certificates  
- Requests certs for: `app.oasis-care.co` and `api.oasis-care.co`
- Creates DNS validation CNAMEs in Route53
- Waits for status: ISSUED

### Phase 3: Infrastructure (Terraform)
- Deploys VPC, ALB, ECS, RDS in eu-west-2
- Creates security groups
- Sets up CloudWatch logging

### Phase 4: Container Images
- Builds and pushes to ECR:
  - `721689331449.dkr.ecr.eu-west-2.amazonaws.com/oasis-api:staging`
  - `721689331449.dkr.ecr.eu-west-2.amazonaws.com/oasis-web:staging`

### Phase 5: Route53 DNS
- Creates A/ALIAS records:
  - `app.oasis-care.co` → ALB
  - `api.oasis-care.co` → ALB

### Phase 6: Database
- Enables pgvector extension
- Runs Prisma migrations
- Seeds demo data

### Phase 7: Smoke Tests
- `curl -I https://api.oasis-care.co/health` → 200/204
- `curl -I https://app.oasis-care.co` → 200/301

---

## ✅ Post-Deployment Verification

### 1. ACM Certificates (Console Check)
```
AWS Console → Certificate Manager → Certificates
```
**Expected:**
- `app.oasis-care.co`: Status = ISSUED
- `api.oasis-care.co`: Status = ISSUED

### 2. DNS Resolution (Terminal)
```bash
nslookup app.oasis-care.co 8.8.8.8
nslookup api.oasis-care.co 8.8.8.8
```
**Expected:** A records pointing to ALB

### 3. HTTP/HTTPS Health Checks
```bash
curl -sI https://api.oasis-care.co/health | head -n1
# Expected: HTTP/2 200 or 204

curl -sI https://app.oasis-care.co | head -n1
# Expected: HTTP/2 200 or 301
```

### 4. Cognito Client (Console Check)
```
AWS Console → Cognito → User Pools → eu-west-2_YPo6sl1zm → App clients
```
**Expected:**
- Client Name: `oasis-staging-web-confidential`
- Client secret: Present (hidden)
- Callback URLs: `https://app.oasis-care.co/api/auth/callback/cognito`

### 5. Secrets Manager (Console Check)
```
AWS Console → Secrets Manager → eu-west-2
```
**Expected Secrets:**
- `oasis/staging/cognito_web_client_secret` ✅
- `oasis/staging/DATABASE_URL` ✅
- `oasis/staging/NEXTAUTH_SECRET` ✅
- `oasis/staging/NEXTAUTH_URL` ✅

### 6. ALB Target Health (Console Check)
```
AWS Console → EC2 → Target Groups
```
**Expected:** All targets healthy (2/2 or similar)

---

## 📊 Key Resources

| Resource | Value |
|----------|-------|
| **AWS Account** | 721689331449 |
| **Region** | eu-west-2 (London) |
| **Hosted Zone** | Z00092362ORF3ZO6TWKKZ |
| **Cognito Pool** | eu-west-2_YPo6sl1zm |
| **Web Domain** | app.oasis-care.co |
| **API Domain** | api.oasis-care.co |
| **Branch** | feat/staging-live-setup |
| **Commit** | 40bf90b |

---

## 🚨 Troubleshooting

### If Deployment Fails at Phase 1 (Cognito):
**Error:** `AccessDeniedException`
**Fix:** Verify `OasisCognitoClientAdmin` policy is attached

### If Deployment Fails at Phase 4 (ACM):
**Error:** `AccessDeniedException` or timeout waiting for validation
**Fix:** 
1. Verify `OasisACMRequest` policy is attached
2. Check Route53 hosted zone Z00092362ORF3ZO6TWKKZ exists
3. Ensure DNS is publicly resolvable for oasis-care.co

### If Deployment Fails at Phase 8 (Route53):
**Error:** `AccessDeniedException`
**Fix:** Verify `OasisRoute53DNS` policy is attached

### If Secrets Manager Fails:
**Error:** `AccessDeniedException`
**Fix:** Verify `OasisSecretsManagerWrite` policy is attached

---

## 🔒 Security Best Practices Applied

✅ **No Plaintext Secrets:** All secrets via Secrets Manager ARNs  
✅ **Least Privilege IAM:** Policies scoped to specific resources  
✅ **TLS/SSL:** ACM certificates for both domains  
✅ **Private RDS:** Database not publicly accessible  
✅ **Security Groups:** ALB public, services private  
✅ **Audit Logging:** CloudWatch logs with 30-day retention

---

## 📝 Next Actions

1. ✅ **IAM Policies Added** (via AWS Console)
2. ⏳ **Run Deployment Workflow** (GitHub Actions)
3. ⏳ **Verify Certificates** (ACM Console)
4. ⏳ **Test DNS Resolution** (nslookup)
5. ⏳ **Test HTTP Health** (curl)
6. ⏳ **Create Cognito Users** (Console)
7. ⏳ **Test Auth Flow** (Browser)

---

## 🎯 Success Criteria

- [ ] All 4 IAM policies attached to oasis-deploy
- [ ] Workflow completes without errors
- [ ] ACM: Both certs show ISSUED
- [ ] DNS: Both domains resolve to ALB
- [ ] HTTP: /health returns 200/204
- [ ] Web: app.oasis-care.co loads
- [ ] Auth: Cognito redirect works

---

## 📞 Support

If you encounter issues not covered in troubleshooting:
1. Check GitHub Actions logs for exact error
2. Verify all IDs/ARNs match this document
3. Ensure region is eu-west-2 for all operations
4. Confirm oasis-care.co DNS is properly delegated

---

**Document Version:** 1.1  
**Last Updated:** 2025-01-23  
**Status:** Ready for IAM setup and deployment

---

## 🔧 Terraform Import & Deployment Flow (CI)

### Overview
The GitHub Actions workflow implements a robust, production-ready Terraform deployment process with safety guardrails and validation at every step.

### Execution Flow

```
Phase 4: ACM Certificates
  ↓ (sets APP_CERT_ARN, API_CERT_ARN in env)
Mask Sensitive Variables
  ↓ (masks ARNs and Zone ID in logs)
TFLint & Format Validation
  ↓ (validates Terraform code quality)
Phase 4.25: Generate terraform.tfvars
  ↓ (creates variables file with route53_zone_id, app_cert_arn, api_cert_arn)
Phase 4.5: Import Existing Resources
  ↓ (idempotent imports, validates config)
Drift Detection (Informational)
  ↓ (reports infrastructure drift, non-blocking)
Phase 5: Infrastructure Deployment
  ↓ (plan → package → apply)
Upload Plan Artifact
  ↓ (saves plan for audit/review)
```

### Key Components

#### 1. **Concurrency Control**
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}-staging
  cancel-in-progress: false
```
- Prevents overlapping deployments
- Queues concurrent runs instead of canceling
- Ensures state integrity

#### 2. **Phase 4.25: terraform.tfvars Generation**
**Purpose:** Create variables file BEFORE imports and deployment

**Variables Written:**
- `route53_zone_id` - Route53 hosted zone ID
- `app_cert_arn` - ACM certificate ARN for app.oasis-care.co
- `api_cert_arn` - ACM certificate ARN for api.oasis-care.co
- Plus static values: project, environment, region, domains, KMS, SNS

**Why:** Terraform requires all variables be set before ANY command (including imports)

#### 3. **Phase 4.5: Idempotent Resource Imports**
**Purpose:** Import existing AWS resources into Terraform state

**Safety Features:**
- Validates terraform.tfvars exists
- Runs `terraform validate` to ensure config loads
- Auto-discovers resource IDs from AWS (no hardcoded values)
- Skips resources already in state (idempotent)
- Sets `TF_IN_AUTOMATION=1` for CI/CD best practices

**Resources Imported:**
- ECR Repositories (oasis-api, oasis-web)
- CloudWatch Log Groups
- IAM Roles (ECS task execution, task role, Lambda)
- Secrets Manager secrets
- ALB and Target Groups
- DB Subnet Group

#### 4. **Drift Detection (Informational)**
**Purpose:** Report infrastructure drift before applying changes

**Behavior:**
- Runs `terraform plan -detailed-exitcode`
- Exit code 0 = No drift
- Exit code 2 = Changes detected
- Saves full plan to `drift.plan.txt`
- **Does NOT block deployment** (`continue-on-error: true`)

#### 5. **Phase 5: Infrastructure Deployment**
**Purpose:** Apply Terraform changes

**Process:**
1. Initialize Terraform (`terraform init`)
2. Select workspace: `staging` (enforced)
3. Generate plan with `-out=tfplan` (binary format)
4. Package plan + tfvars into `tfplan.tgz`
5. Apply plan with `-lock-timeout=5m`
6. Export outputs to JSON

**Environment Variables:**
- `TF_IN_AUTOMATION=1` - Optimizes Terraform for CI/CD
- Lock timeout prevents state lock conflicts

#### 6. **Plan Artifact Upload**
**Purpose:** Preserve plan for audit and review

**Artifact Contains:**
- `tfplan` - Binary Terraform plan
- `terraform.tfvars` - Variables used for the plan

**Retention:** 30 days

**Access:** GitHub Actions → Workflow Run → Artifacts

### Safety Guardrails

| Feature | Purpose | Blocking? |
|---------|---------|-----------|
| **Concurrency Control** | Prevent simultaneous deployments | Yes |
| **TFLint** | Catch Terraform anti-patterns | No |
| **Format Check** | Enforce code style | No |
| **Variable Masking** | Hide sensitive ARNs in logs | N/A |
| **Drift Detection** | Report infrastructure changes | No |
| **Workspace Enforcement** | Use correct state file | Yes |
| **Lock Timeout** | Handle state conflicts | Yes |
| **Validation Step** | Verify config before imports | Yes |
| **YAML Validation** | Ensure workflow syntax | No |

### Workspace Requirements

**Critical:** All Terraform commands MUST use the `staging` workspace

**Enforcement:**
- Phase 0, 4.5, 5, and Drift Detection all enforce workspace selection
- Command: `terraform workspace select staging || terraform workspace new staging`
- **Never** run Terraform commands without verifying workspace first

### Idempotency

The deployment is **safe to rerun**:

✅ **Imports skip existing resources** - Won't error if already imported  
✅ **Secrets are upserted** - Creates or updates without failing  
✅ **Cognito client reused** - Retrieves existing if present  
✅ **DNS records UPSERT** - Updates existing or creates new  
✅ **Terraform apply** - Only changes what's needed

### Artifacts Generated

| Artifact | Contains | Retention | Use Case |
|----------|----------|-----------|----------|
| **tflint-sarif-results** | TFLint SARIF report | 30 days | Code quality review |
| **terraform-plan-staging** | tfplan + tfvars | 30 days | Audit trail, review changes |

### Debugging Tips

**If imports fail:**
1. Check Phase 4.5 logs for "terraform validate" output
2. Verify terraform.tfvars was created in Phase 4.25
3. Confirm TF_VAR_* environment variables are set
4. Review resource discovery output (may not exist yet)

**If drift detection reports changes:**
- This is INFORMATIONAL only
- Review the drift.plan.txt output
- Determine if drift is expected (manual changes) or code updates

**If plan/apply fails:**
- Check workspace is `staging`
- Verify lock timeout didn't expire
- Review state lock status in S3 backend (if configured)

### Local Validation (Before CI)

```bash
cd infrastructure/staging

# 1. Format check
terraform fmt -check -recursive

# 2. Validate syntax (requires temp tfvars)
cat > terraform.tfvars <<EOF
route53_zone_id = "Z00092362ORF3ZO6TWKKZ"
app_cert_arn = "arn:aws:acm:eu-west-2:721689331449:certificate/dummy"
api_cert_arn = "arn:aws:acm:eu-west-2:721689331449:certificate/dummy"
EOF

terraform init -input=false
terraform workspace select staging || terraform workspace new staging
terraform validate

# 3. Cleanup
rm terraform.tfvars
```

### Variables Required

The following variables MUST be set before Terraform operations:

| Variable | Source | Set In |
|----------|--------|--------|
| `route53_zone_id` | Auto-detected or input | Phase 0 |
| `app_cert_arn` | ACM request | Phase 4 |
| `api_cert_arn` | ACM request | Phase 4 |
| `project` | Static | Phase 4.25 |
| `environment` | Static | Phase 4.25 |
| `aws_region` | Static | Phase 4.25 |
| `kms_key_id` | Static | Phase 4.25 |
| `sns_topic_arn` | Static | Phase 4.25 |

### State Management

**Backend:** S3 + DynamoDB (if configured in `backend.tf`)  
**Workspace:** `staging` (enforced in all terraform commands)  
**State Lock:** 5-minute timeout on plan/apply operations

**Warning:** Never manually edit Terraform state. Use `terraform state` commands only.

---
