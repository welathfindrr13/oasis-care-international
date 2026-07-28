#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 1 ]]; then
  printf 'Usage: %s <verified-env-file>\n' "$0" >&2
  exit 64
fi

ENV_FILE="$1"
if [[ ! -f "$ENV_FILE" || -L "$ENV_FILE" ]]; then
  printf 'WEB_BUILD_ENV_FILE_INVALID\n' >&2
  exit 65
fi

(
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  required_names=(
    AUTH_IDENTITY_PROVIDER
    NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER
    NEXT_PUBLIC_CLERK_CSP_ORIGINS
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    NEXTAUTH_URL
    NEXTAUTH_SECRET
  )
  for name in "${required_names[@]}"; do
    if [[ -z "${!name:-}" ]]; then
      printf 'WEB_BUILD_ENV_MISSING=%s\n' "$name" >&2
      exit 66
    fi
  done

  pnpm --filter @oasis/web build
)
