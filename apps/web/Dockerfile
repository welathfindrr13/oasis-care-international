FROM node:20-alpine
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Enable pnpm via Corepack
RUN corepack enable

# Copy the whole monorepo (simplest + robust for workspace deps)
COPY . .

# Install deps and build the web app
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile

# Bake env vars at build time (Next.js inlines NEXT_PUBLIC_* vars)
ARG NEXT_PUBLIC_API_URL=https://api.oasis-care.co/graphql
ARG NEXT_PUBLIC_SITE_URL=https://app.oasis-care.co
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN pnpm --filter @oasis/web build

# Runtime config
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm","--filter","@oasis/web","start"]
