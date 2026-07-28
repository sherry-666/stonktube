# ---- builder: install + build ----
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

# Copy all manifests first (layer cache for install)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages/shared/package.json   ./packages/shared/
COPY packages/db/package.json       ./packages/db/
COPY packages/pipeline/package.json ./packages/pipeline/
COPY apps/api/package.json          ./apps/api/
COPY apps/worker/package.json       ./apps/worker/
COPY apps/scheduler/package.json    ./apps/scheduler/
COPY apps/web/package.json          ./apps/web/

RUN pnpm install --frozen-lockfile

# Copy source after install so source changes don't bust the install cache
COPY packages/ ./packages/
COPY apps/api/       ./apps/api/
COPY apps/worker/    ./apps/worker/
COPY apps/scheduler/ ./apps/scheduler/
COPY apps/web/       ./apps/web/

# VITE_API_URL is baked into client bundles at build time by Vite.
# API_URL is used at runtime by the SSR server to reach the API service.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# turbo respects dependsOn: ["^build"] — builds in topological order
RUN pnpm run build

# ---- runtime: lean final image ----
FROM node:22-alpine AS runtime
WORKDIR /app

RUN corepack enable

COPY --from=builder /app/package.json        ./
COPY --from=builder /app/pnpm-lock.yaml      ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules        ./node_modules
COPY --from=builder /app/packages            ./packages
COPY --from=builder /app/apps/api            ./apps/api
COPY --from=builder /app/apps/worker         ./apps/worker
COPY --from=builder /app/apps/scheduler      ./apps/scheduler
COPY --from=builder /app/apps/web/build      ./apps/web/build
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules

# Default to api; Railway overrides this per-service via Start Command.
# Web service start command:
#   sh -c 'cd /app/apps/web && ./node_modules/.bin/react-router-serve build/server/index.js'
# Web service also needs env var: API_URL=<same value as VITE_API_URL>
CMD ["node", "apps/api/dist/index.js"]
