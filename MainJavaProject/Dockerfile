# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY tests ./tests
COPY scripts ./scripts
RUN npm run lint && npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system gss \
  && useradd --system --gid gss --create-home --home-dir /home/gss gss

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --chown=gss:gss package.json package-lock.json ./
COPY --chown=gss:gss src ./src
COPY --chown=gss:gss scripts ./scripts

USER gss
EXPOSE 3000
CMD ["node", "./src/bootstrap/server.ts"]