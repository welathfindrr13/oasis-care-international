#!/bin/bash

# AWS credential test script for Oasis project
# Usage: ./scripts/test-aws.sh

set -e

echo "🔍 Testing AWS credentials..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Install with: brew install awscli"
    exit 1
fi

# Test basic AWS access
echo "🔐 Checking AWS identity..."
if aws sts get-caller-identity --profile oasis --output table; then
    echo "✅ AWS credentials working"
else
    echo "❌ AWS credentials failed. Run: aws configure --profile oasis"
    exit 1
fi

# Test ECR access
echo "🐳 Testing ECR access..."
REGISTRY="721689331449.dkr.ecr.eu-west-2.amazonaws.com"

if aws ecr get-login-password --region eu-west-2 --profile oasis > /dev/null; then
    echo "✅ ECR access working"
    
    # Try ECR login
    echo "🔑 Testing ECR login..."
    if aws ecr get-login-password --region eu-west-2 --profile oasis | \
       docker login --username AWS --password-stdin $REGISTRY 2>/dev/null; then
        echo "✅ ECR login successful"
        docker logout $REGISTRY 2>/dev/null || true
    else
        echo "⚠️  ECR login failed (Docker may not be running)"
    fi
else
    echo "❌ ECR access failed"
    exit 1
fi

echo ""
echo "🎉 All AWS tests passed!"
echo "📝 Ready to use:"
echo "   • AWS CLI with 'oasis' profile"
echo "   • ECR repository: $REGISTRY/oasis-api"
echo "   • GitHub Actions will auto-build on push to main"
