# ---- build stage ----
FROM node:20-slim AS build

# Install native build dependencies for node-gyp packages
RUN apt-get update && apt-get install -y python3 make g++ openssl && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy package.json files for all workspaces
COPY apps/api/package.json ./apps/api/
COPY libs/auth/package.json ./libs/auth/
COPY libs/db/package.json ./libs/db/

# Install dependencies for all workspaces
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN cd libs/db && npx prisma generate

# Build libs explicitly (not declared as npm deps, just tsconfig paths)
# Force a clean auth build so dist JS is emitted inside Docker as well.
RUN cd libs/auth && rm -rf dist tsconfig.tsbuildinfo && pnpm exec tsc -p tsconfig.json --incremental false && test -f dist/index.js
RUN cd libs/db && pnpm build

# Build the API
RUN cd apps/api && pnpm build

# ---- production image ----
FROM node:20-slim AS production

# Install openssl for Prisma and curl for health checks
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# Install pnpm for production
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy package.json files
COPY apps/api/package.json ./apps/api/
COPY libs/auth/package.json ./libs/auth/
COPY libs/db/package.json ./libs/db/

# Patch libs package.json to point to compiled dist instead of src
RUN sed -i 's|"main": "src/index.ts"|"main": "dist/index.js"|g' ./libs/auth/package.json && \
    sed -i 's|"main": "src/index.ts"|"main": "dist/index.js"|g' ./libs/db/package.json

# Install production dependencies only
RUN pnpm install --prod --no-frozen-lockfile

# Create symlinks for workspace packages (pnpm doesn't do this in prod mode)
RUN mkdir -p node_modules/@oasis && \
    ln -sf /app/libs/auth node_modules/@oasis/auth && \
    ln -sf /app/libs/db node_modules/@oasis/db

# Copy built application from build stage
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Copy compiled libs
COPY --from=build /app/libs/auth/dist ./libs/auth/dist
COPY --from=build /app/libs/db/dist ./libs/db/dist

# Copy Prisma schema and generated client (includes query engine)
COPY --from=build /app/libs/db/prisma ./libs/db/prisma
COPY --from=build /app/libs/db/src/generated ./libs/db/src/generated
# Also copy to dist/ where the compiled code expects it
COPY --from=build /app/libs/db/src/generated ./libs/db/dist/generated

# Copy entrypoint script
COPY apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nestjs
USER nestjs

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
