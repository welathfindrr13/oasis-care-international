# ---- build stage ----
FROM node:20-alpine AS build

# Install native build dependencies for node-gyp packages
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy package.json files for all workspaces
COPY apps/api/package.json ./apps/api/
COPY libs/*/package.json ./libs/*/

# Install dependencies for all workspaces
RUN pnpm install --no-frozen-lockfile

# ─── Diagnostic: list all workspaces Turbo detects ─────────────────────────────
# This prints a JSON array of unique workspace names.  You should see each name
# only once; if "@oasis/db" (or any other) appears twice, we know duplication is
# happening after the COPY steps.
RUN pnpm dlx turbo list --json \
    | jq '.packages | map(.name) | unique' \
    || true

# Copy source code
COPY . .

# Set Prisma schema path and generate client
ENV PRISMA_SCHEMA=libs/db/prisma/schema.prisma
# RUN pnpm exec prisma generate --schema=libs/db/prisma/schema.prisma

# Build the application (Turbo first builds dependent libs)
RUN pnpm turbo run build --filter=@oasis/api

# ---- production image ----
FROM node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

# Install pnpm for production
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy package.json files
COPY apps/api/package.json ./apps/api/
COPY libs/*/package.json ./libs/*/

# Install only production dependencies
RUN pnpm install --prod

# Copy built application
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/libs ./libs

# Copy Prisma schema and generated client
COPY --from=build /app/libs/db/prisma ./libs/db/prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
