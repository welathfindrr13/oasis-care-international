# Phase 5 Infrastructure Deployment - Diagnostic Report

**Date:** 2025-10-20  
**Run URL:** https://github.com/welathfindrr13/oasis-care-international/actions/runs/18643275858  
**Phase:** Phase 5 - Infrastructure Deployment  
**Status:** ❌ Failed  
**Duration:** ~5 minutes into deployment

## 🔍 Error Details

### Terraform Error Block

```
╷
│ Error: reading Route 53 Hosted Zones: operation error Route 53: ListHostedZones, 
│ https response error StatusCode: 403, RequestID: 35f60c43-a4c7-4d1c-9db0-a60cc6471fda, 
│ api error AccessDenied: User: arn:aws:iam::***:user/oasis-deploy is not authorized 
│ to perform: route53:ListHostedZones because no identity-based policy allows the 
│ route53:ListHostedZones action
│ 
│   with data.aws_route53_zone.main,
│   on route53.tf line 2, in data "aws_route53_zone" "main":
│    2: data "aws_route53_zone" "main" {
│ 
╵
```

### Affected Resource
- **File:** `infrastructure/staging/route53.tf`
- **Line:** 2
- **Resource:** `data "aws_route53_zone" "main"`

## 📋 Classification

**Failure Type:** IAM Permission Deficiency

**Root Cause:** The `OasisRoute53DNS` IAM policy has `route53:ListHostedZonesByName` but Terraform's `data.aws_route53_zone` data source requires the more general `route53:ListHostedZones` action to enumerate zones.

### Current Policy vs Required

**Current OasisRoute53DNS policy:**
```json
{
  "Sid": "ListZonesByName",
  "Effect": "Allow",
  "Action": ["route53:ListHostedZonesByName"],
  "Resource": "*"
}
```

**What Terraform Needs:**
- `route53:ListHostedZones` - General zone listing (required by data source)

## 🔧 Remediation Plan

### Option 1: Add ListHostedZones Action (Recommended)

Update the `OasisRoute53DNS` policy in AWS Console to include `route53:ListHostedZones`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListZonesGeneral",
      "Effect": "Allow",
      "Action": [
        "route53:ListHostedZonesByName",
        "route53:ListHostedZones"
      ],
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

**Change:** Added `"route53:ListHostedZones"` to the first statement's Action array.

### Option 2: Alternative - Remove Data Source (Not Recommended)

If you want to avoid the data source lookup entirely, you could modify `route53.tf` to not use the data source since the zone_id is already provided via variable. However, this reduces validation and is not recommended.

## ✅ Implementation Steps

1. **Update IAM Policy in AWS Console:**
   - Navigate to: IAM → Users → oasis-deploy → Permissions
   - Find inline policy: `OasisRoute53DNS`
   - Edit JSON
   - Add `"route53:ListHostedZones"` to the ListZonesGeneral actions array
   - Save policy

2. **Verify Policy Update:**
   ```bash
   aws iam get-user-policy \
     --user-name oasis-deploy \
     --policy-name OasisRoute53DNS \
     --query 'PolicyDocument.Statement[0].Action' \
     --output json
   ```
   Should show both `ListHostedZonesByName` and `ListHostedZones`

3. **Trigger New Deployment:**
   ```bash
   gh workflow run deploy-staging.yml --ref feat/staging-live-setup
   ```

4. **Monitor Phase 5:**
   - Should pass the Route53 data source lookup
   - Should proceed to create/update ALB, target groups, and DNS records
   - Watch for any new Terraform errors

## 📊 Expected Outcome After Fix

With `route53:ListHostedZones` permission added:
- ✅ Phase 5 will successfully read the hosted zone
- ✅ Terraform plan/apply will proceed
- ✅ Infrastructure resources (VPC, ALB, ECS, etc.) will be created/updated
- ✅ Deployment should reach Phase 6 (Container Images)

## 🎯 Verification Checklist

After applying the IAM policy fix:
- [ ] IAM policy updated with `ListHostedZones` action
- [ ] Trigger new deployment workflow
- [ ] Phase 5 passes Route53 data source lookup
- [ ] Terraform apply completes successfully
- [ ] Infrastructure resources provisioned
- [ ] Deployment proceeds to Phase 6+

## 📝 Notes

- **Scope:** This is a simple IAM permission issue, not a Terraform configuration problem
- **Impact:** Blocks all infrastructure provisioning in Phase 5
- **Fix Complexity:** Low - single IAM action addition
- **Related:** Phase 0 uses `ListHostedZonesByName` (different action for name-based lookup)
- **Status of Previous Phases:**
  - Phase 0-4: ✅ All passed (including our Phase 2.5 and Phase 3 fixes)
  - Phase 5: ❌ Blocked by this IAM issue
  - Phase 6-12: Not reached

## 🔗 References

- **Terraform AWS Provider Docs:** https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/route53_zone
- **AWS Route53 IAM Actions:** https://docs.aws.amazon.com/Route53/latest/APIReference/API_Operations.html
- **Our Route53 Config:** `infrastructure/staging/route53.tf`
- **IAM Policy:** `STAGING_DEPLOYMENT_GUIDE.md` (should be updated with this fix)

## 🚀 Quick Fix Command

For AWS CLI users with appropriate permissions:

```bash
# Get current policy
aws iam get-user-policy --user-name oasis-deploy --policy-name OasisRoute53DNS > current_policy.json

# Edit current_policy.json to add "route53:ListHostedZones" to the Action array

# Update policy
aws iam put-user-policy \
  --user-name oasis-deploy \
  --policy-name OasisRoute53DNS \
  --policy-document file://current_policy.json
```

Or use the AWS Console (easier for manual fix).
