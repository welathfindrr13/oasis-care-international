FROM node:20-alpine
WORKDIR /app

# Enable pnpm via Corepack
RUN corepack enable

# Copy the whole monorepo (simplest + robust for workspace deps)
COPY . .

# Install deps and build the web app
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @oasis/web build

# Runtime config
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm","--filter","@oasis/web","start"]
