FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS deps

RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --ignore-scripts
# pnpm 11 strict mode blocks postinstall — manually node-gyp the native module
RUN cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 \
    && npx --yes node-gyp rebuild --release
RUN pnpm exec prisma generate

FROM deps AS migrator

CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM base AS builder

RUN apk add --no-cache python3 make g++

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm prisma generate
RUN pnpm build

FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Standalone strips better-sqlite3's build/ dir (dynamic bindings tracer can't see) — restore it
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/.pnpm/better-sqlite3@12.9.0/node_modules/better-sqlite3/build ./node_modules/better-sqlite3/build

RUN mkdir -p /app/uploads \
  && touch /app/dev.db \
  && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
