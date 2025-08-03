# Oasis‑Care • Staging Environment (eu‑west‑2)

This directory spins up an **isolated staging stack** using AWS + Terraform.

```bash
# one‑time backend (state) prep – creates S3 + DynamoDB
./scripts/setup-backend.sh

# deploy / update the stack
./scripts/deploy-staging.sh

# run DB migrations after the first deploy (idempotent)
./scripts/run-migration.sh

# smoke‑test that GraphQL is alive
./scripts/smoke-test.sh
```

**Prerequisites**
* AWS CLI configured (`AWS_PROFILE=oasis`) with rights to eu‑west‑2
* Terraform ≥ 1.6
* Route 53 hosted zone for `oasis-care.com`
* S3 bucket + DynamoDB table for remote state (created by `setup-backend.sh`)
