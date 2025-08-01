# ---- build stage ----
FROM node:20-alpine AS build

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./

# Copy package.json files for all workspaces
COPY apps/api/package.json ./apps/api/
COPY libs/*/package.json ./libs/*/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm --filter @oasis/db prisma generate

# Build the application
RUN pnpm --filter @oasis/api build

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
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/libs ./libs

# Copy Prisma schema and generated client
COPY --from=build /app/libs/db/prisma ./libs/db/prisma
COPY --from=build /app/node_modules/.pnpm/registry.npmjs.org/@prisma ./node_modules/.pnpm/registry.npmjs.org/@prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
