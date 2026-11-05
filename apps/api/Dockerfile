# Build a partir da raiz do monorepo:  docker build -f apps/api/Dockerfile -t agrogenius-api .
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @agrogenius/api --workspace @agrogenius/shared --include-workspace-root=false

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY firmware firmware
RUN npm run build -w @agrogenius/shared \
 && npx --workspace @agrogenius/api prisma generate \
 && npm run build -w @agrogenius/api

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/firmware firmware
WORKDIR /app/apps/api
USER node
EXPOSE 4000
# As migrações correm no arranque; o seed do catálogo é idempotente.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
