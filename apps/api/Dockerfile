FROM node:20-alpine AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --prod

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/ apps/api/
COPY packages/ packages/
COPY tsconfig.base.json ./
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @cherny/api build

FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup -S cherny && adduser -S cherny -G cherny

# Copy only the built API and its production node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./

USER cherny

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
