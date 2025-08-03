# 🚀 Oasis Care API - Staging Deployment Guide

## Overview

This guide will help you deploy the Oasis Care API to a complete AWS staging environment including:
- **VPC** with isolated networking
- **RDS PostgreSQL** database 
- **ECS Fargate** container service
- **Application Load Balancer** with HTTPS
- **Route53** DNS and SSL certificates
- **Secrets management** via AWS services

## Prerequisites

### 1. AWS Setup
- AWS CLI installed and configured
- AWS profile named `oasis` with permissions for:
  - VPC, EC2, RDS, ECS, ELB, Route53, ACM
  - Secrets Manager, Systems Manager Parameter Store
  - S3, DynamoDB (for Terraform state)

### 2. Domain Setup  
- Route53 hosted zone for `oasis-care.com` must exist
- Or update `variables.tf` to use your domain

### 3. Tools
- Terraform 1.6+
- Docker (for image builds)
- jq (for parsing JSON outputs)

## Deployment Steps

### Step 1: One-time Backend Setup

```bash
cd infrastructure
./scripts/setup-backend.sh
```

This creates:
- S3 bucket: `oasis-terraform-state-eu-west-2`
- DynamoDB table: `oasis-terraform-locks`

### Step 2: Build and Push Latest Image

```bash
./scripts/push-image.sh
```

This builds the API Docker image and pushes to ECR.

### Step 3: Deploy Infrastructure

```bash
./scripts/deploy-staging.sh
```

This will:
- Initialize Terraform
- Plan the deployment (review changes)
- Apply infrastructure changes
- Show outputs including endpoints

**Expected time:** 10-15 minutes (mainly waiting for RDS and certificate validation)

### Step 4: Run Database Migrations

```bash
./scripts/run-migration.sh
```

This runs `prisma migrate deploy` in a one-off ECS task.

### Step 5: Verify Deployment

```bash
./scripts/smoke-test.sh
```

Tests:
- Health check endpoint (`/healthz`)
- GraphQL introspection
- Schema validation

## What Gets Created

### Networking
- **VPC**: `10.1.0.0/16` with DNS enabled
- **Public Subnets**: `10.1.1.0/24`, `10.1.2.0/24` (ALB)
- **Private Subnets**: `10.1.10.0/24`, `10.1.11.0/24` (ECS, RDS)
- **NAT Gateway**: Single AZ for cost optimization

### Compute
- **ECS Cluster**: `oasis-care-staging-cluster`
- **ECS Service**: 1 Fargate task (256 CPU, 512 MB RAM)
- **Container**: Latest API image from ECR

### Database
- **RDS**: PostgreSQL 15.6 on `db.t3.micro`
- **Storage**: 20 GB encrypted
- **Network**: Private subnets only
- **Credentials**: Auto-generated, stored in Secrets Manager

### Load Balancer
- **ALB**: Public-facing with HTTPS only
- **Target Group**: Health checks on `/healthz`
- **Certificate**: Auto-provisioned via ACM + Route53

### Security
- **Database URL**: Stored in AWS Secrets Manager
- **JWT Secret**: Stored in AWS Parameter Store  
- **Security Groups**: Minimal required access
- **IAM Roles**: Least privilege for ECS tasks

## Endpoints

After deployment:
- **GraphQL API**: `https://staging-api.oasis-care.com/graphql`
- **Health Check**: `https://staging-api.oasis-care.com/healthz`
- **Metrics**: `https://staging-api.oasis-care.com/metrics` (admin auth required)

## Troubleshooting

### Check ECS Service Health
```bash
aws ecs describe-services \
  --cluster oasis-care-staging-cluster \
  --services oasis-care-staging-svc
```

### View Logs
```bash
aws logs tail /ecs/oasis-care-staging --follow
```

### Check RDS Connectivity
```bash
# From ECS task (if needed)
aws ecs run-task \
  --cluster oasis-care-staging-cluster \
  --task-definition oasis-care-staging-api \
  --launch-type FARGATE \
  --overrides '{"containerOverrides":[{"name":"api","command":["sh","-c","sleep 3600"]}]}'
```

### Certificate Issues
- Ensure Route53 hosted zone exists
- Check ACM certificate validation in AWS Console
- DNS propagation can take 5-10 minutes

## Costs (Approximate)

**Monthly staging costs:**
- RDS t3.micro: ~$15/month
- ECS Fargate: ~$10/month  
- ALB: ~$20/month
- NAT Gateway: ~$32/month
- **Total: ~$77/month**

## Cleanup

To destroy the staging environment:

```bash
cd infrastructure/staging
terraform destroy -auto-approve
```

⚠️ **Warning**: This will permanently delete all data in the staging database.
