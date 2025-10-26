# ECS Services Not Creating - Root Cause Analysis

**Date:** 2025-10-26
**Issue:** ECS Cluster is active but has 0 services, 0 tasks, 0 task definitions

## 🔍 Dependency Chain Blocking Service Creation

```
ACM Certificates (Phase 4)
    ↓ (validation TIMES OUT)
aws_lb_listener.https
    ↓ (can't create without certs)
aws_ecs_service.api
aws_ecs_service.web
    ↓ (never created)
ECS Tasks
    ↓
Application DOESN'T RUN
```

## 📋 Evidence from Terraform Code

**File:** `infrastructure/staging/ecs-service.tf` (lines 202, 232)

```hcl
resource "aws_ecs_service" "api" {
  # ... config ...
  depends_on = [aws_lb_listener.https]  # ← BLOCKS creation until listener exists
}

resource "aws_ecs_service" "web" {
  # ... config ...
  depends_on = [aws_lb_listener.https]  # ← BLOCKS creation until listener exists
}
```

**File:** `infrastructure/staging/alb.tf` (line 103)

```hcl
resource "aws_lb_listener" "https" {
  # ... config ...
  certificate_arn = aws_acm_certificate_validation.api.certificate_arn  # ← Waits for validation
  
  depends_on = [
    aws_acm_certificate_validation.api,
    aws_acm_certificate_validation.web
  ]
}
```

## 🚨 Phase 4 ACM Validation Failure

From previous GitHub Actions logs:
```
⏳ Waiting for certificate validation (this may take 5-10 minutes)...

Waiter CertificateValidated failed: Max attempts exceeded.
ValidationStatus: PENDING_VALIDATION
```

**Why it times out:**
- Workflow requests NEW certificates every time
- Creates DNS validation records
- Waits for validation
- Times out after max attempts (~10 minutes)
- Certificates never reach ISSUED state

## 💡 Solutions (in order of preference)

### Option 1: Use Terraform-Managed ACM Certificates (RECOMMENDED)
- Move ACM cert creation into Terraform (`infrastructure/staging/acm.tf` - already exists!)
- Remove Phase 4 from workflow
- Let Terraform handle validation via `aws_acm_certificate_validation` resource
- This ensures certificates are properly tracked in state

### Option 2: Skip Certificate Dependency Temporarily
- Remove `depends_on = [aws_lb_listener.https]` from ECS services
- Deploy services without HTTPS first
- Add HTTPS listener later once certs are resolved
- Services will be accessible but only via ALB's direct DNS (not custom domain)

### Option 3: Use Pre-Created/Existing Certificates
- Manually create certificates in ACM once
- Reference existing certificate ARNs in Terraform
- Skip Phase 4 entirely
- Faster, but manual certificate management

## ✅ Recommended Fix

**Use Option 1 - Terraform-Managed Certificates**

The file `infrastructure/staging/acm.tf` already exists and appears to have certificate definitions. We should:

1. **Remove Phase 4** from GitHub Actions workflow (cert request/validation)
2. **Let Terraform manage ACM** via the existing acm.tf
3. **Update alb.tf** to use Terraform-managed cert references
4. This fixes the dependency chain and makes it reproducible

This is how it SHOULD work in proper IaC - Terraform manages all resources, not the CI/CD workflow.
