#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo ">>> Running database migrations..."
  cd /app/libs/db
  npx prisma migrate deploy
  echo ">>> Migrations complete."
else
  echo ">>> Skipping database migrations. Set RUN_MIGRATIONS=true to run Prisma migrate deploy."
fi

echo ">>> Starting API server..."
cd /app
exec node /app/apps/api/dist/apps/api/src/main.js
