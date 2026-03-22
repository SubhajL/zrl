# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV CI=true
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json nest-cli.json tsconfig.json tsconfig.build.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY src ./src
RUN npm run db:generate
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated
EXPOSE 3000
CMD ["node", "dist/main"]
