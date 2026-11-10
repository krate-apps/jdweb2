# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json web/
COPY server/package.json server/
RUN pnpm install --frozen-lockfile
COPY web web
COPY server server
ARG JDWEB_BASE_PATH=
ENV JDWEB_BASE_PATH=$JDWEB_BASE_PATH
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
RUN pnpm install --frozen-lockfile --filter ./server --prod
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist
RUN chown -R node:node /app
USER node
EXPOSE 8787
CMD ["node", "server/dist/index.js"]
