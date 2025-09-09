#!/usr/bin/env bash
set -euo pipefail
API_URL="${API_URL:-http://localhost:3000}"
WEB_URL="${WEB_URL:-http://localhost:3001}"
echo "[SMOKE] API /health:"; curl -sfS "$API_URL/health" | head -c 200; echo
echo "[SMOKE] WEB /up (if present):"; curl -sfS "$WEB_URL/up" | head -c 200 || echo "(no /up)"; echo
