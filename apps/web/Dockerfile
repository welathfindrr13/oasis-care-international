FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.13.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_API_URL=https://app.oasis-care.local/api/graphql
ARG NEXT_PUBLIC_SITE_URL=https://app.oasis-care.local
ARG NEXTAUTH_URL=https://app.oasis-care.local
ARG COGNITO_ISSUER=https://example.invalid/oasis-build-only
ARG COGNITO_CLIENT_ID=build-only-client-id

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV COGNITO_ISSUER=$COGNITO_ISSUER
ENV COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID
ENV NEXT_TELEMETRY_DISABLED=1

RUN NEXTAUTH_SECRET=build-only-nextauth-secret-change-at-runtime-32chars \
    COGNITO_CLIENT_SECRET=build-only-client-secret \
    pnpm --filter @oasis/web build

FROM node:20-alpine AS production
WORKDIR /app

RUN apk add --no-cache curl libc6-compat
RUN corepack enable && corepack prepare pnpm@9.13.1 --activate

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web ./apps/web

EXPOSE 3000

CMD ["pnpm", "--filter", "@oasis/web", "start"]
