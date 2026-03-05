#!/bin/sh

echo ">>> Running database migrations..."
cd /app/libs/db
if npx prisma migrate deploy; then
  echo ">>> Migrations complete."
else
  echo ">>> Migration failed, but continuing to start server..."
fi

echo ">>> Starting API server..."
exec node /app/apps/api/dist/apps/api/src/main.js


