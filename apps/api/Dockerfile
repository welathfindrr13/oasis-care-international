# ---- build stage ----
FROM node:20-alpine AS build

# Install native build dependencies for node-gyp packages
RUN apk add --no-cache python3 make g++ openssl

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
RUN cd libs/auth && pnpm build
RUN cd libs/db && pnpm build

# Build the API
RUN cd apps/api && pnpm build

# ---- production image ----
FROM node:20-alpine AS production

# Install openssl for Prisma and curl for health checks
RUN apk add --no-cache openssl curl

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

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3000

CMD ["node", "apps/api/dist/apps/api/src/main.js"]
