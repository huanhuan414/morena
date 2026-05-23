FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY server/package.json ./server/package.json

RUN pnpm install --frozen-lockfile

COPY api-tests ./api-tests
COPY server ./server

RUN pnpm --filter server build

FROM base AS development

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY server/package.json ./server/package.json

RUN pnpm install --frozen-lockfile

COPY api-tests ./api-tests
COPY server ./server

WORKDIR /app

FROM base AS runtime

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/node_modules ./server/node_modules

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/cert ./server/cert
COPY --from=build /app/server/uploads ./uploads

WORKDIR /app/server

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
