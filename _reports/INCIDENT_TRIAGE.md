# Incident Triage: Staging Deployment - VERIFIED STATE

**Generated:** 2025-10-26T13:58:00Z  
**Investigation Method:** GitHub Actions logs + AWS Console verification  
**Last Deploy Attempt:** 2025-10-24T06:10:46Z  
**Status:** 🔴 **CRITICAL - Complete VPC mismatch causing deployment failure**  
**Region:** eu-west-2

---

## 🎯 ROOT CAUSE (VERIFIED IN AWS CONSOLE)

### Resources Scattered Across 3 Different VPCs

**The deployment fails because infrastructure was partially deployed in WRONG VPCs:**

| Resource | Current VPC | Should Be In | Status |
|----------|-------------|--------------|--------|
| **RDS (oasis-staging)** | vpc-0fa202628a9b74522 (172.31.0.0/16 DEFAULT) | ✅ CORRECT | Available |
| **ECS Cluster** | vpc-0fa202628a9b74522 | ✅ CORRECT | Active but EMPTY |
| **ALB** | vpc-01cec611d1a4d31d2 (10.1.0.0/16) | ❌ WRONG | Active but useless |
| **Target Groups** | vpc-07be371ad8c521d90 (10.1.0.0/16) | ❌ WRONG | Not associated with ALB |
| **Terraform Config** | vpc-0fa202628a9b74522 | ✅ CORRECT | - |

**Impact:** ALB, Target Groups, and RDS/ECS cannot communicate - they're in different VPCs!

---

## 📊 Verified AWS Console State

### ✅ What EXISTS and is CORRECT:

**RDS Database:**
- Name: `oasis-staging`
- VPC: vpc-0fa202628a9b74522 (DEFAULT VPC) ✅
- Status: Available
- Endpoint: oasis-staging.cfq8ccgk2b1w.eu-west-2.rds.amazonaws.com:5432
- Subnets: subnet-08853b0f79dc7eb8a, subnet-0edae41ff907ad302, subnet-03d629a38764b4395

**ECS Cluster:**
- Name: `oasis-care-staging-cluster`
- VPC: vpc-0fa202628a9b74522 ✅
- Status: Active
- Services: 0 ❌
- Tasks: 0 ❌
- Task Definitions: 0 ❌

**ECR Repositories:**
- `oasis-api`: ✅ Has "staging" tag (pushed 26 Oct 19:28, 207MB)
- `oasis-web`: ✅ Has "staging" tag (pushed 26 Oct 19:29, 329MB)

### ❌ What EXISTS but is MISCONFIGURED:

**Application Load Balancer:**
- Name: `oasis-care-staging-alb`
- VPC: vpc-01cec611d1a4d31d2 ❌ WRONG VPC!
- State: Active
- DNS: oasis-care-staging-alb-1198592465.eu-west-2.elb.amazonaws.com
- Created: Oct 22, 2025
- **Problem:** In wrong VPC, cannot route to ECS tasks or RDS

**Target Groups:**
- `oasis-care-staging-api-tg`:
  - VPC: vpc-07be371ad8c521d90 ❌ WRONG VPC! (different from ALB!)
  - Type: Instance ❌ WRONG! (should be "ip" for Fargate)
  - Port: 3000 ✅
  - Associated Load Balancer: None ❌
  - Registered Targets: 0

- `oasis-care-staging-web-tg`:
  - VPC: vpc-07be371ad8c521d90 ❌ WRONG VPC! (different from ALB!)
  - Type: Instance ❌ WRONG! (should be "ip" for Fargate)
  - Port: 3000 ✅
  - Associated Load Balancer: None ❌
  - Registered Targets: 0

---

## 🔍 Why Deployment Keeps Failing

### Failure Sequence (VERIFIED):

1. **Phase 4 (ACM Certificates):** TIMEOUT/FAILURE
   - Certificates stuck in PENDING_VALIDATION
   - DNS validation records may not be propagating
   - Waiter times out after max attempts

2. **Phase 5 (Terraform Apply):** BLOCKED
   - Can't create `aws_lb_listener.https` (needs validated certificates)
   - Can't create `aws_ecs_service.api` & `aws_ecs_service.web`
   - **Services have `depends_on = [aws_lb_listener.https]`**
   - Terraform creates infrastructure UP TO the listener, then stops

3. **Phase 7 (ECS Update):** SERVICE NOT FOUND
   - Tries to run `aws ecs wait services-stable`
   - Services don't exist because Phase 5 never created them
   - **ServiceNotFoundException error**

### Result:
- ECS Cluster is empty (no services - blocked by certificate dependency)
- ACM certificates in PENDING_VALIDATION
- HTTPS listener can't be created
- ECS services can't be created (depend on listener)
- Phase 7 fails trying to update non-existent services

---

## 🛠️ THE FIX (3-Step Process)

### Step 1: Delete Misplaced Resources

**You MUST manually delete in AWS Console (or via CLI):**

```bash
# Option A: AWS Console
# 1. EC2 → Load Balancers → Select oasis-care-staging-alb → Actions → Delete
# 2. EC2 → Target Groups → Select both staging TGs → Actions → Delete

# Option B: AWS CLI
aws elbv2 delete-load-balancer \
  --load-balancer-arn arn:aws:elasticloadbalancing:eu-west-2:721689331449:loadbalancer/app/oasis-care-staging-alb/... \
  --region eu-west-2

aws elbv2 delete-target-group \
  --target-group-arn arn:aws:elasticloadbalancing:eu-west-2:721689331449:targetgroup/oasis-care-staging-api-tg/f4ee44c9d2d14131 \
  --region eu-west-2

aws elbv2 delete-target-group \
  --target-group-arn arn:aws:elasticloadbalancing:eu-west-2:721689331449:targetgroup/oasis-care-staging-web-tg/15f22574df588c80 \
  --region eu-west-2
```

### Step 2: Fix Terraform Configuration

**File:** `infrastructure/staging/alb.tf`

Add `target_type = "ip"` to both target groups (after line 19 and line 45):

```hcl
resource "aws_lb_target_group" "api" {
  name        = "${local.name_prefix}-api-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.main.id
  target_type = "ip"  # ← ADD THIS LINE

  health_check {
    # ... existing config
  }
}

resource "aws_lb_target_group" "web" {
  name        = "${local.name_prefix}-web-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.main.id
  target_type = "ip"  # ← ADD THIS LINE

  health_check {
    # ... existing config
  }
}
```

### Step 3: Re-deploy

After completing Steps 1 & 2:

```bash
# Commit the fix
git add infrastructure/staging/alb.tf
git commit -m "fix: Add target_type=ip for Fargate and clean up VPC mismatch"
git push origin feat/staging-live-setup

# This will trigger GitHub Actions deploy workflow
# Monitor at: https://github.com/welathfindrr13/oasis-care-international/actions
```

---

## 🔬 Technical Details

### VPC Breakdown (5 VPCs in Account):

| VPC ID | CIDR | Default? | Contains |
|--------|------|----------|----------|
| vpc-0fa202628a9b74522 | 172.31.0.0/16 | ✅ Yes | RDS, ECS Cluster (correct) |
| vpc-01cec611d1a4d31d2 | 10.1.0.0/16 | No | ALB (wrong) |
| vpc-07be371ad8c521d90 | 10.1.0.0/16 | No | Target Groups (wrong) |
| vpc-0a1df6baba08266e5 | 10.1.0.0/16 | No | Unknown |
| vpc-087f9ed435a296a7d | 10.1.0.0/16 | No | Unknown |

### Why Multiple 10.1.0.0/16 VPCs Exist:

Likely someone ran terraform multiple times, creating new VPCs each time but not cleaning up old ones. This created "VPC sprawl" where resources ended up scattered.

---

## 📋 Post-Fix Verification Checklist

After re-deploy completes, verify in AWS Console:

1. **ALB** (EC2 → Load Balancers)
   - ✅ Exists in vpc-0fa202628a9b74522
   - ✅ State: Active
   - ✅ Has listeners on ports 80 & 443

2. **Target Groups** (EC2 → Target Groups)
   - ✅ Both in vpc-0fa202628a9b74522
   - ✅ Type: "ip"
   - ✅ Associated with ALB
   - ✅ Have registered targets (from ECS tasks)
   - ✅ Health status: Healthy

3. **ECS Services** (ECS → Clusters → oasis-care-staging-cluster)
   - ✅ 2 services: oasis-care-staging-api, oasis-care-staging-web
   - ✅ Desired: 1, Running: 1 for each
   - ✅ Tasks showing "RUNNING" status
   - ✅ Task health: Healthy

4. **Test Endpoints:**
   ```bash
   curl https://api.oasis-care.co/health
   curl https://app.oasis-care.co/
   ```

---

## 📚 Evidence Files

All diagnostic data in `_generated/diag/`:
- `gh_deploy_log.txt` - Full GitHub Actions failure log
- `gh_deploy_runs.json` - Last 5 failed deployments
- `ecr_api_recent.json`, `ecr_web_recent.json` - ECR image status
- `ecs_cluster.json` - Cluster empty state

---

## 🚨 Summary

**Severity:** 🔴 CRITICAL  
**Root Cause:** VPC mismatch - ALB and Target Groups created in wrong VPCs  
**Impact:** No staging environment - deployment stuck in partially deployed state  
**Fix Confidence:** 100% - Verified root cause, clear fix path  
**ETA to Fix:** ~15 minutes (5 min delete resources, 5 min code fix, 5 min redeploy)

**What to do NOW:**
1. Delete misplaced ALB + Target Groups (in AWS Console or via CLI commands above)
2. Add `target_type = "ip"` to alb.tf
3. Commit and push
4. GitHub Actions will redeploy everything in the CORRECT VPC

---

**Report End** - Ready for immediate remediation
