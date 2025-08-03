#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Deploying staging infrastructure..."

cd "$(dirname "$0")/../staging"

# Initialize Terraform
terraform init -upgrade

# Plan the deployment
echo "📋 Planning deployment..."
terraform plan

# Apply changes
echo "🔧 Applying changes..."
terraform apply -auto-approve "$@"

# Display outputs
echo "✅ Deployment complete!"
echo ""
echo "📊 Outputs:"
terraform output

echo ""
echo "🔍 Next steps:"
echo "  1. Run ./scripts/run-migration.sh to set up the database"
echo "  2. Run ./scripts/smoke-test.sh to verify the deployment"
