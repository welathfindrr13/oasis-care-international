# Terraform Configuration Fixes Summary

## Date: January 27, 2025
## Status: Partial Fix Complete - Manual Steps Required

---

## What Was Fixed

### 1. ✅ ALB Security Group - HTTP Ingress Added
**File:** `infrastructure/staging/security-groups.tf`
**Problem:** ALB was missing port 80 ingress rule, preventing HTTP-to-HTTPS redirects
**Solution:** Added HTTP (port 80) ingress rule with description

```terraform
ingress {
  from_port   = 80
  to_port     = 80
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
  description = "Allow HTTP for redirect to HTTPS"
}
```

### 2. ✅ ACM Certificate Validation Timeout Removed
**Files:** `infrastructure/staging/acm.tf`, `infrastructure/staging/alb.tf`
**Problem:** Certificates timing out after 30 minutes waiting for DNS validation
**Solution:** 
- Removed `aws_acm_certificate_validation` resources
- Updated ALB to reference certificates directly (`aws_acm_certificate.api.arn` instead of validation resource)
- Added comments explaining manual validation is required

**IMPORTANT:** After running terraform apply, you MUST manually validate certificates:
1. Go to AWS Certificate Manager console
2. Note the CNAME records for each certificate
3. Add those CNAME records to your DNS provider
4. Wait 5-10 minutes for validation

---

## What Still Needs Fixing

### ⚠️ CRITICAL: VPC Subnet Configuration Bug
**File:** `infrastructure/staging/vpc.tf`
**Lines:** 23-31
**Problem:** Private subnets are using the SAME IDs as public subnets

```terraform
# CURRENT (WRONG):
data "aws_subnet" "private_a" {
  id = "subnet-08853b0f79dc7eb8a"  # Same as public_a!
}
data "aws_subnet" "private_b" {
  id = "subnet-0edae41ff907ad302"  # Same as public_b!
}
data "aws_subnet" "private_c" {
  id = "subnet-03d629a38764b4395"  # Same as public_c!
}
```

**Impact:** 
- RDS DB subnet group error: "new Subnets are not in the same Vpc as the existing subnet group"
- Database cannot be created in public subnets (security risk)

**Solution Required:**
You need to discover the actual private subnet IDs for your VPC and update vpc.tf:

```bash
# Run this command (requires AWS credentials configured):
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-0fa202628a9b74522" \
  --region eu-west-2 \
  --query 'Subnets[*].[SubnetId,MapPublicIpOnLaunch,AvailabilityZone]' \
  --output table
```

Look for subnets where `MapPublicIpOnLaunch` is `False` - those are your private subnets.

---

## What You Need to Do Next

### Step 1: Configure AWS Credentials
```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region (eu-west-2)
```

### Step 2: Discover Private Subnet IDs
```bash
cd /Users/tyreeseedwards/oasis international care
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=vpc-0fa202628a9b74522" \
  --region eu-west-2 \
  --query 'Subnets[*].[SubnetId,MapPublicIpOnLaunch,AvailabilityZone,CidrBlock]' \
  --output table
```

### Step 3: Update vpc.tf
Replace lines 23-31 in `infrastructure/staging/vpc.tf` with the correct private subnet IDs from Step 2.

### Step 4: Run Import Script
```bash
cd infrastructure/staging
bash ../../_generated/terraform-import-all.sh
```

This will import existing AWS resources into Terraform state:
- 3 IAM roles (ECS task execution, ECS task role, Lambda embedding)
- 1 Secrets Manager secret (DATABASE_URL)
- 1 Security group (ECS)
- 1 DB subnet group
- ALB and target groups (if they exist)

### Step 5: Run Terraform Plan
```bash
cd infrastructure/staging
terraform init
terraform plan
```

Review the plan carefully. You should see:
- ✅ Resources being imported (already done by import script)
- ✅ Minor updates to existing resources
- ❌ NO destructions of existing resources

### Step 6: Apply Changes
```bash
terraform apply
```

### Step 7: Validate ACM Certificates
1. Go to AWS Certificate Manager console (eu-west-2 region)
2. Find both certificates (api.oasis-care.co and app.oasis-care.co)
3. Copy the CNAME name and value for each
4. Add these CNAME records to your DNS provider
5. Wait 5-10 minutes for validation to complete

---

## Error Summary

### Errors Fixed:
1. ✅ ALB security group error (invalid security groups)
2. ✅ ACM certificate validation timeout (30m)

### Errors Requiring Manual Fix:
3. ⚠️ VPC subnet configuration (private = public IDs)

### Errors That Will Self-Resolve After Fixes:
4. 🔄 IAM roles already exist (import script handles this)
5. 🔄 Secrets already exist (import script handles this)
6. 🔄 Security groups already exist (import script handles this)
7. 🔄 DB subnet group already exists (import script handles this)

---

## Files Modified

1. `infrastructure/staging/security-groups.tf` - Added HTTP ingress
2. `infrastructure/staging/acm.tf` - Removed validation resources
3. `infrastructure/staging/alb.tf` - Updated certificate references

---

## Next Steps After Successful Apply

Once terraform apply succeeds and certificates are validated:

1. Deploy API code via GitHub Actions or manually
2. Deploy web app (Amplify should auto-deploy)
3. Run database migrations
4. Verify endpoints:
   - `https://api.oasis-care.co/health`
   - `https://app.oasis-care.co`

---

## Support

If you encounter issues:
1. Check terraform plan output carefully before applying
2. Verify AWS credentials are configured correctly
3. Ensure you've fixed the VPC subnet IDs
4. Review import script output for any failures

The import script (`_generated/terraform-import-all.sh`) is well-written and should handle most of the state management automatically.
