#!/usr/bin/env bash
set -euo pipefail

REPO="721689331449.dkr.ecr.eu-west-2.amazonaws.com/oasis-backend"
TAG="latest"
REGION="eu-west-2"

echo "🔐 Logging into ECR..."
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin "$REPO"

echo "🔨 Building Docker image..."
cd "$(dirname "$0")/../.."  # Go to project root
docker build -t oasis-api -f apps/api/Dockerfile .

echo "🏷️ Tagging as $REPO:$TAG"
docker tag oasis-api:latest "$REPO:$TAG"

echo "🚀 Pushing to ECR..."
docker push "$REPO:$TAG"

echo "✅ Done! Image pushed to $REPO:$TAG"
