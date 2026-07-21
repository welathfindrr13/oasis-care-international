FROM node:20-alpine AS build

RUN apk add --no-cache python3 make g++ openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@9.13.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY libs/auth/package.json ./libs/auth/
COPY libs/db/package.json ./libs/db/
COPY libs/time/package.json ./libs/time/

RUN pnpm install --frozen-lockfile

COPY . .

RUN rm -f libs/auth/tsconfig.tsbuildinfo libs/db/tsconfig.tsbuildinfo libs/time/tsconfig.tsbuildinfo && \
    rm -rf libs/auth/dist libs/db/dist libs/time/dist

RUN cd libs/db && pnpm prisma generate
RUN cd libs/auth && pnpm build
RUN cd libs/db && pnpm build
RUN cd libs/time && pnpm build
RUN cd apps/api && pnpm build

FROM node:20-alpine AS production

RUN apk add --no-cache openssl curl libc6-compat
RUN corepack enable && corepack prepare pnpm@9.13.1 --activate

ENV NODE_ENV=production
ENV PORT=4000
ARG APP_VERSION=unknown
ARG APP_COMMIT_SHA=unknown
ENV APP_VERSION=$APP_VERSION
ENV APP_COMMIT_SHA=$APP_COMMIT_SHA
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY libs/auth/package.json ./libs/auth/
COPY libs/db/package.json ./libs/db/
COPY libs/time/package.json ./libs/time/

RUN sed -i 's|"main": "src/index.ts"|"main": "dist/index.js"|g' ./libs/auth/package.json && \
    sed -i 's|"main": "src/index.ts"|"main": "dist/index.js"|g' ./libs/db/package.json && \
    sed -i 's|"main": "src/index.ts"|"main": "dist/index.js"|g' ./libs/time/package.json

RUN pnpm install --prod --frozen-lockfile

RUN mkdir -p node_modules/@oasis && \
    rm -rf node_modules/@oasis/auth node_modules/@oasis/db node_modules/@oasis/time && \
    ln -s /app/libs/auth node_modules/@oasis/auth && \
    ln -s /app/libs/db node_modules/@oasis/db && \
    ln -s /app/libs/time node_modules/@oasis/time

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/libs/auth/dist ./libs/auth/dist
COPY --from=build /app/libs/db/dist ./libs/db/dist
COPY --from=build /app/libs/time/dist ./libs/time/dist
COPY --from=build /app/libs/db/prisma ./libs/db/prisma
COPY --from=build /app/libs/db/src/generated ./libs/db/src/generated
COPY --from=build /app/libs/db/src/generated ./libs/db/dist/generated

# Fail the image build if a compiled workspace dependency cannot resolve under
# the production Node.js runtime.
RUN node -e "require('@oasis/auth'); require('@oasis/db'); require('@oasis/time')"

COPY apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs
USER nestjs

EXPOSE 4000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
