# ACM Certificate Migration Guide

## Issue Summary

The ACM certificate (ARN: `arn:aws:acm:eu-west-2:721689331449:certificate/435970fe-5f05-44cb-b521-864df099cfb1`) is stuck in "Pending validation" status because the DNS validation records were never created in Route53.

## Root Cause

The certificates were manually created in ACM but:
1. The DNS validation records were never added to Route53
2. The certificates were not managed by Terraform
3. The infrastructure expected certificate ARNs to be passed as variables

## Solution

We've updated the infrastructure to manage ACM certificates with automatic DNS validation through Terraform.

### Changes Made

1. **Created `infrastructure/staging/acm.tf`**
   - Defines ACM certificates for both API and Web domains
   - Configures DNS validation method
   - Automatically creates Route53 validation records
   - Includes certificate validation resources that wait for validation to complete

2. **Updated `infrastructure/staging/alb.tf`**
   - Changed to reference Terraform-managed certificates
   - Added proper dependencies to ensure certificates are validated before ALB uses them

3. **Updated `infrastructure/staging/variables.tf`**
   - Removed `app_cert_arn` and `api_cert_arn` variables (no longer needed)

## Migration Steps

### Prerequisites

- AWS CLI configured with appropriate credentials
- Terraform 1.0+ installed
- Access to Route53 hosted zone for oasis-care.co
- `jq` installed for JSON parsing (`brew install jq` on macOS)

### Step 0: Clean Up Failed/Pending Certificates (REQUIRED if you have multiple certificates)

If you have multiple failed or pending certificates (which is the case based on your ACM console showing 20+ certificates), you **MUST** run the cleanup script first:

```bash
# Run the automated cleanup script
./infrastructure/scripts/cleanup-acm-certificates.sh
```

This script will:
- List all ACM certificates for oasis-care domains
- Show their status (FAILED, PENDING_VALIDATION, ISSUED)
- Delete all FAILED and PENDING_VALIDATION certificates that are not in use
- Preserve any ISSUED certificates
- Provide a summary of actions taken

**Why This Matters:**
- Having multiple pending/failed certificates indicates DNS validation was never properly configured
- These orphaned certificates clutter your ACM console
- AWS has quotas on certificate requests that could be reached
- Clean slate ensures Terraform can create new certificates without conflicts

**What the script does NOT do:**
- It will NOT delete certificates that are currently in use by resources
- It will NOT delete ISSUED certificates (in case they're needed)
- It requires explicit confirmation before deleting anything

After running the cleanup script and seeing the success message, proceed to Step 1.

### Step 1: Import Existing Resources (If Needed)

If you want to import the existing certificate into Terraform state instead of creating new ones:

```bash
cd infrastructure/staging

# Import the existing certificate (if you want to keep it)
terraform import aws_acm_certificate.api arn:aws:acm:eu-west-2:721689331449:certificate/435970fe-5f05-44cb-b521-864df099cfb1

# Note: You'll need to identify and import the web certificate ARN as well
```

### Step 2: Or Delete Existing Certificate and Let Terraform Create New Ones

**Recommended approach:** Delete the pending certificate and let Terraform create validated ones:

```bash
# Delete the existing pending certificate via AWS Console or CLI
aws acm delete-certificate \
  --certificate-arn arn:aws:acm:eu-west-2:721689331449:certificate/435970fe-5f05-44cb-b521-864df099cfb1 \
  --region eu-west-2
```

### Step 3: Update Terraform Variables

Ensure your `terraform.tfvars` or variable definitions don't include the removed certificate variables:

```hcl
# Remove these lines if present:
# api_cert_arn = "arn:aws:acm:..."
# app_cert_arn = "arn:aws:acm:..."

# Keep these required variables:
route53_zone_id = "your-zone-id-here"
```

### Step 4: Initialize and Plan

```bash
cd infrastructure/staging

# Initialize (in case of new providers/modules)
terraform init

# Review the changes
terraform plan
```

Expected output should show:
- Creation of `aws_acm_certificate.api`
- Creation of `aws_acm_certificate.web`
- Creation of `aws_route53_record.api_cert_validation`
- Creation of `aws_route53_record.web_cert_validation`
- Creation of `aws_acm_certificate_validation.api`
- Creation of `aws_acm_certificate_validation.web`
- Updates to `aws_lb_listener.https` and `aws_lb_listener_certificate.web`

### Step 5: Apply Changes

```bash
terraform apply
```

The apply process will:
1. Create new ACM certificates for both domains
2. Automatically create DNS validation records in Route53
3. Wait for certificate validation to complete (up to 10 minutes)
4. Update the ALB to use the new validated certificates

### Step 6: Verify

After apply completes, verify the certificates:

```bash
# Check certificate status
aws acm describe-certificate \
  --certificate-arn $(terraform output -raw api_certificate_arn) \
  --region eu-west-2

# Check DNS records
aws route53 list-resource-record-sets \
  --hosted-zone-id your-zone-id-here \
  --query "ResourceRecordSets[?Type=='CNAME']"
```

Certificate status should show "ISSUED" instead of "PENDING_VALIDATION".

### Step 7: Test HTTPS Endpoints

```bash
# Test API endpoint
curl -I https://api.oasis-care.co/health

# Test Web endpoint
curl -I https://app.oasis-care.co
```

## Rollback Plan

If issues occur during migration:

1. **If certificates fail to validate:**
   ```bash
   # Check Route53 records were created
   aws route53 list-resource-record-sets --hosted-zone-id your-zone-id
   
   # Verify domain ownership if needed
   dig _acm-challenge.api.oasis-care.co
   ```

2. **If ALB can't use new certificates:**
   ```bash
   # Revert to previous Terraform version
   git checkout HEAD~1 infrastructure/staging/
   terraform apply
   ```

3. **If complete rollback needed:**
   - Manually create certificates in ACM console
   - Manually add validation records to Route53
   - Update variables with certificate ARNs
   - Revert git changes and reapply

## Benefits of New Approach

1. **Fully automated validation** - No manual DNS record creation needed
2. **Infrastructure as Code** - Certificates are versioned and reproducible
3. **Automatic renewal** - AWS handles certificate renewal
4. **Consistent state** - Terraform tracks all certificate-related resources
5. **Easy disaster recovery** - Can recreate entire infrastructure from code

## Troubleshooting

### Certificate stuck in "PENDING_VALIDATION"

Check if DNS records were created:
```bash
aws route53 list-resource-record-sets \
  --hosted-zone-id your-zone-id \
  --query "ResourceRecordSets[?Type=='CNAME' && contains(Name, '_acm-challenge')]"
```

### Validation taking too long

- DNS propagation can take 5-10 minutes
- Terraform waits up to 10 minutes (configurable in `timeouts` block)
- If timeout occurs, simply run `terraform apply` again

### Wrong hosted zone

Ensure `route53_zone_id` variable points to the correct hosted zone for `oasis-care.co`.

## Additional Notes

- The new certificates will have different ARNs than the old pending certificate
- Any references to old certificate ARNs in documentation or configurations should be updated
- The certificate validation happens during `terraform apply` - plan time will be quick
- Certificate renewal is automatic and handled by AWS (no action needed)

## Related Files

- `infrastructure/staging/acm.tf` - ACM certificate definitions
- `infrastructure/staging/alb.tf` - Load balancer configuration
- `infrastructure/staging/variables.tf` - Variable definitions
- `infrastructure/staging/route53.tf` - DNS configuration

## Support

If issues persist:
1. Check AWS ACM console for certificate status
2. Review Route53 hosted zone for validation records
3. Check CloudWatch Logs for ALB errors
4. Review Terraform state: `terraform state list | grep acm`
