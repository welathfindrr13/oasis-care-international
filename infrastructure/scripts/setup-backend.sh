#!/usr/bin/env bash
set -euo pipefail

REGION="eu-west-2"
BUCKET="oasis-terraform-state-eu-west-2"
TABLE="oasis-terraform-locks"

echo "🔧 Setting up Terraform backend in $REGION..."

# Create S3 bucket for state
aws s3 mb "s3://$BUCKET" --region "$REGION" || echo "ℹ️  Bucket already exists"

# Enable versioning on the bucket
aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table --table-name "$TABLE" \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region "$REGION" 2>/dev/null || echo "ℹ️  DynamoDB table already exists"

echo "✅ Terraform backend ready ($BUCKET, $TABLE)"
