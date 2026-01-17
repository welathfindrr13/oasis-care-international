#!/bin/bash
# ACM Certificate Cleanup Script
# This script deletes all failed and pending ACM certificates for oasis-care domains
# Run this before applying the new Terraform configuration

set -e

AWS_REGION="eu-west-2"
DOMAINS=("api.oasis-care.co" "app.oasis-care.co" "api.oasis-care.com" "app.oasis-care.com")

echo "🧹 ACM Certificate Cleanup Script"
echo "=================================="
echo ""
echo "This will delete all FAILED and PENDING certificates for:"
for domain in "${DOMAINS[@]}"; do
    echo "  - $domain"
done
echo ""
echo "WARNING: This is a destructive operation. Make sure no certificates are in use."
echo ""
read -p "Continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Fetching certificates..."

# Get all certificates in the region
CERTS=$(aws acm list-certificates \
    --region "$AWS_REGION" \
    --output json)

# Extract certificate ARNs for our domains
CERT_ARNS=$(echo "$CERTS" | jq -r '.CertificateSummaryList[] | select(.DomainName | test("oasis-care\\.(co|com)$")) | .CertificateArn')

if [ -z "$CERT_ARNS" ]; then
    echo "No certificates found for oasis-care domains."
    exit 0
fi

DELETED_COUNT=0
SKIPPED_COUNT=0
FAILED_COUNT=0

echo ""
echo "Processing certificates..."
echo ""

while IFS= read -r cert_arn; do
    # Get certificate details
    CERT_DETAILS=$(aws acm describe-certificate \
        --certificate-arn "$cert_arn" \
        --region "$AWS_REGION" \
        --output json 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        echo "  Result: ⚠️  Could not fetch certificate details"
        continue
    fi
    
    DOMAIN=$(echo "$CERT_DETAILS" | jq -r '.Certificate.DomainName')
    STATUS=$(echo "$CERT_DETAILS" | jq -r '.Certificate.Status')
    IN_USE=$(echo "$CERT_DETAILS" | jq -r '.Certificate.InUseBy | length')
    
    echo "Certificate: $DOMAIN"
    echo "  ARN: $cert_arn"
    echo "  Status: $STATUS"
    echo "  In Use: $([[ "$IN_USE" -gt 0 ]] && echo "Yes ($IN_USE resources)" || echo "No")"
    
    # Only delete if not in use and status is FAILED or PENDING_VALIDATION
    if [[ "$IN_USE" == "0" ]] && ([[ "$STATUS" == "FAILED" ]] || [[ "$STATUS" == "PENDING_VALIDATION" ]]); then
        echo "  Action: DELETING"
        if aws acm delete-certificate \
            --certificate-arn "$cert_arn" \
            --region "$AWS_REGION" 2>/dev/null; then
            echo "  Result: ✅ Deleted successfully"
            ((DELETED_COUNT++))
        else
            echo "  Result: ❌ Failed to delete"
            ((FAILED_COUNT++))
        fi
    else
        if [[ "$IN_USE" -gt 0 ]]; then
            echo "  Action: SKIPPING (in use)"
        elif [[ "$STATUS" == "ISSUED" ]]; then
            echo "  Action: SKIPPING (issued and might be needed)"
        else
            echo "  Action: SKIPPING (status: $STATUS)"
        fi
        ((SKIPPED_COUNT++))
    fi
    echo ""
done <<< "$CERT_ARNS"

echo "=================================="
echo "Cleanup Summary:"
echo "  Deleted: $DELETED_COUNT"
echo "  Skipped: $SKIPPED_COUNT"
echo "  Failed:  $FAILED_COUNT"
echo ""

if [ $DELETED_COUNT -gt 0 ]; then
    echo "✅ Cleanup complete! You can now run Terraform to create new certificates."
    echo ""
    echo "Next steps:"
    echo "  1. cd infrastructure/staging"
    echo "  2. terraform init"
    echo "  3. terraform plan"
    echo "  4. terraform apply"
else
    echo "ℹ️  No certificates were deleted."
fi
