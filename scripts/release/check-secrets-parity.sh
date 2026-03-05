#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-eu-west-2}"
STAGING_PREFIX="${STAGING_PREFIX:-oasis/staging}"
PRODUCTION_PREFIX="${PRODUCTION_PREFIX:-oasis/production}"
CHECK_STAGING="${CHECK_STAGING:-true}"
CHECK_PRODUCTION="${CHECK_PRODUCTION:-false}"

required_suffixes=(
  "COGNITO_CLIENT_SECRET"
  "DATABASE_URL"
  "NEXTAUTH_SECRET"
  "NEXTAUTH_URL"
)

missing=0

check_secret() {
  local secret_name="$1"
  if aws secretsmanager describe-secret --region "$AWS_REGION" --secret-id "$secret_name" >/dev/null 2>&1; then
    echo "OK: $secret_name"
  else
    echo "MISSING: $secret_name" >&2
    missing=$((missing + 1))
  fi
}

if [[ "$CHECK_STAGING" == "true" ]]; then
  echo "Checking staging secrets in prefix: $STAGING_PREFIX"
  for suffix in "${required_suffixes[@]}"; do
    check_secret "${STAGING_PREFIX}/${suffix}"
  done
fi

if [[ "$CHECK_PRODUCTION" == "true" ]]; then
  echo "Checking production parity in prefix: $PRODUCTION_PREFIX"
  for suffix in "${required_suffixes[@]}"; do
    check_secret "${PRODUCTION_PREFIX}/${suffix}"
  done
fi

if [[ "$missing" -gt 0 ]]; then
  echo "Secret preflight failed with ${missing} missing secret(s)." >&2
  exit 1
fi

echo "Secret preflight passed."
