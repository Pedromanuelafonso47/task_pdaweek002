# Build a partir da raiz:  docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.exemplo.ao/api -t agrogenius-web .
# (Em produção recomenda-se Vercel para o frontend; este Dockerfile serve para self-hosting.)
FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @agrogenius/web --workspace @agrogenius/shared --include-workspace-root=false
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @agrogenius/shared && npm run build -w @agrogenius/web

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/apps/web apps/web
WORKDIR /app/apps/web
USER node
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
