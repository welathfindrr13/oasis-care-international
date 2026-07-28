#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 1 ]]; then
  printf 'Usage: %s <verified-env-file>\n' "$0" >&2
  exit 64
fi

ENV_FILE="$1"
if [[ ! -f "$ENV_FILE" || -L "$ENV_FILE" ]]; then
  printf 'WEB_IMAGE_ENV_FILE_INVALID\n' >&2
  exit 65
fi

(
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  required_names=(
    NEXT_PUBLIC_API_URL
    NEXT_PUBLIC_SITE_URL
    NEXTAUTH_URL
    NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    NEXT_PUBLIC_CLERK_CSP_ORIGINS
    NEXT_PUBLIC_CLERK_SIGN_IN_URL
    NEXT_PUBLIC_CLERK_SIGN_UP_URL
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL
  )
  for name in "${required_names[@]}"; do
    if [[ -z "${!name:-}" ]]; then
      printf 'WEB_IMAGE_ENV_MISSING=%s\n' "$name" >&2
      exit 66
    fi
  done

  docker build \
    --build-arg NEXT_PUBLIC_API_URL \
    --build-arg NEXT_PUBLIC_SITE_URL \
    --build-arg NEXTAUTH_URL \
    --build-arg NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER \
    --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    --build-arg NEXT_PUBLIC_CLERK_CSP_ORIGINS \
    --build-arg NEXT_PUBLIC_CLERK_SIGN_IN_URL \
    --build-arg NEXT_PUBLIC_CLERK_SIGN_UP_URL \
    --build-arg NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL \
    --build-arg NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL \
    -f apps/web/Dockerfile \
    -t oasis-web:v2 \
    .
)
