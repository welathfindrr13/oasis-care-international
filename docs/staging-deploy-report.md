
---

## Update: 2025-10-22 12:31 - Run #5 After PR #2 (ASCII Security Groups Fix)

**Run URL:** https://github.com/welathfindrr13/oasis-care-international/actions/runs/18706380863  
**Commit:** 9ab7ca5 (after merging PR #2)  
**Policy in force:** OasisStagingTerraformPolicy (updated) attached to user oasis-deploy  
**Duration:** 7m12s

### Result
- Workflow conclusion: **failure**
- Created: 2025-10-22T05:31:17Z
- Phases 0-4: ✅ ALL PASSED
- Phase 5 (Infrastructure): ❌ FAILED (but progress made!)

### Phase Results
✅ Phase 0 - Pre-flight Setup  
✅ Phase 1 - Cognito Client Secret  
✅ Phase 2 - RDS Setup  
✅ Phase 2.5 - Secrets Manager Preflight Check  
✅ Phase 3 - Secrets Manager (Application Secrets Only) ← **ORIGINAL FIX STILL WORKING**  
✅ Phase 4 - ACM Certificates  
❌ Phase 5 - Infrastructure Deployment - **FAILED** (but ASCII fix successful!)

### ✅ ASCII Security Groups Fix - VALIDATED

**SUCCESS:** No "Character sets beyond ASCII are not supported" errors found in Phase 5 logs!

The non-ASCII arrow symbol (➞) replacement with ASCII "to" successfully resolved the security group description errors. This confirms that 1 of the 6 Phase 5 blockers from run 18675484763 is now fixed.

**Changed descriptions:**
- ECS: "Allow ALB to ECS" (was "Allow ALB ➞ ECS")
- RDS: "Allow ECS to RDS" (was "Allow ECS ➞ RDS")

### Phase 5 Remaining Errors

**IAM Permission Errors (3 occurrences - reduced from previous runs):**
Still missing same core permissions as run 18675484763:
- SNS:ListTagsForResource
- iam:GetRole
- sqs:ListQueueTags
- ec2:ModifySubnetAttribute

**Resource Conflicts (11 occurrences):**
- ECR repositories (oasis-api, oasis-web) already exist
- DATABASE_URL secret already exists  
- Other infrastructure resources from previous partial deployments

### Smoke Tests
- API /health: unreachable (deployment incomplete)
- Web /: unreachable (deployment incomplete)

### Progress Summary

| Issue | Status |
|-------|--------|
| Non-ASCII security group descriptions | ✅ FIXED (PR #2) |
| Missing IAM permissions | ⚠️ Still blocking |
| ECR repositories already exist | ⚠️ Need import |
| DATABASE_URL secret already exists | ⚠️ Need import |
| Duplicate egress rules | ✅ Not detected (different SGs) |

### Next Steps

1. ✅ ~~Fix ASCII security group descriptions~~ - **COMPLETE**
2. ⚠️ Update OasisStagingTerraformPolicy with missing permissions:
   - Add SNS:ListTagsForResource
   - Add iam:GetRole to IAM block
   - Add sqs:ListQueueTags to SQS block
   - Add ec2:ModifySubnetAttribute to EC2 block
3. ⚠️ Import existing resources into Terraform state:
   ```bash
   cd infrastructure/staging
   terraform import aws_ecr_repository.api oasis-api
   terraform import aws_ecr_repository.web oasis-web
   terraform import aws_secretsmanager_secret.database_url \
     arn:aws:secretsmanager:eu-west-2:721689331449:secret:oasis/staging/DATABASE_URL
   ```
4. ⚠️ Re-run deployment after IAM policy updates

### Documentation
- PR #2: https://github.com/welathfindrr13/oasis-care-international/pull/2 (merged)
- IAM Policy Guide: docs/PHASE5-IAM-DEPLOYMENT-GUIDE.md
- Comprehensive Policy: docs/oasis-deploy-iam-policy.json (needs updates per above)

---

## Update: 2025-10-22 13:14 - Run #6 After Diagnostic Workflow Setup

**Run URL:** https://github.com/welathfindrr13/oasis-care-international/actions/runs/18707138376  
**Commit:** 02492a6 (after merging PR #3 - diagnostic workflow)  
**Diagnostic Run:** https://github.com/welathfindrr13/oasis-care-international/actions/runs/18707018555 (failed - permission probes blocked)  
**Duration:** 8m57s  
**Policy in force:** OasisStagingTerraformPolicy (updated) attached to user oasis-deploy

### Result
- Workflow conclusion: **failure**
- Phases 0-4: ✅ ALL PASSED (Secrets Manager fix continues working perfectly)
- Phase 5 (Infrastructure): ❌ FAILED

### ⚠️ NEW Critical Discovery: ec2:GetSecurityGroupsForVpc

**CRITICAL NEW ERROR** discovered in ALB creation:
```
Error: creating ELBv2 application Load Balancer (oasis-care-staging-alb): 
User: arn:aws:iam::***:user/oasis-deploy is not authorized to perform: 
ec2:GetSecurityGroupsForVpc
```

This is a **blocking permission** for creating Application Load Balancers. Without this permission, ALB cannot verify security group associations with the VPC.

### Phase 5 Complete IAM Error List (8 unique errors)

1. ❌ **ec2:GetSecurityGroupsForVpc** (NEW - CRITICAL for ALB)
2. ❌ **SNS:GetSubscriptionAttributes** (blocks SNS topic subscription management)
3. Plus the previously identified errors from Run #5

### Phase 5 Resource Conflicts

Same resource conflicts as Run #5:
- ELBv2 Target Groups (oasis-care-staging-api-tg, oasis-care-staging-web-tg) already exist
- ECR repositories (oasis-api, oasis-web) already exist  
- CloudWatch log groups already exist
- IAM roles already exist

### Diagnostic Workflow Outcome

The diagnostic workflow (PR #3) successfully merged but encountered permission errors during execution:
- Diagnostic run 18707018555 failed  
- Permission probes themselves were blocked (user lacks permissions to run diagnostic tests)
- No artifacts generated
- This confirms the oasis-deploy user has very limited permissions

### Smoke Tests
- API /health: unreachable (deployment incomplete)
- Web /: unreachable (deployment incomplete)

### Updated IAM Policy Requirements

The OasisStagingTerraformPolicy now needs these ADDITIONAL permissions beyond those identified in Run #4 and #5:

**EC2 (NEW - CRITICAL):**
```json
"ec2:GetSecurityGroupsForVpc"
```

**SNS (NEW):**
```json
"sns:GetSubscriptionAttributes"
```

**Plus all previously identified missing permissions:**
- SNS:ListTagsForResource
- iam:GetRole
- sqs:ListQueueTags  
- ec2:ModifySubnetAttribute

### Deployment History Updated

| Run | Date | Phases 0-4 | Phase 5 | Key Finding |
|-----|------|------------|---------|-------------|
| 18706380863 | 2025-10-22 | ✅ | ❌ | ASCII fix validated, IAM gaps remain |
| 18707138376 | 2025-10-22 | ✅ | ❌ | **NEW: ec2:GetSecurityGroupsForVpc blocking ALB** |

### Next Steps

1. ⚠️ **CRITICAL:** Add `ec2:GetSecurityGroupsForVpc` to EC2 permissions block
2. ⚠️ Add `sns:GetSubscriptionAttributes` to SNS permissions block
3. ⚠️ Add all previously identified missing permissions
4. ⚠️ Import existing resources into Terraform state
5. ⚠️ Re-run deployment after ALL IAM policy updates applied

### Documentation
- Diagnostic Workflow: `.github/workflows/diagnose-auth-perms.yml` (PR #3 merged)
- IAM Policy Guide: `docs/PHASE5-IAM-DEPLOYMENT-GUIDE.md` 
- Comprehensive Policy: `docs/oasis-deploy-iam-policy.json` (requires comprehensive update)
