# syntax=docker/dockerfile:1

# Multi-stage build for the storefront. Works on any container host — Render,
# Railway, Fly.io, Cloud Run — and needs only DATABASE_URL and the secrets
# listed in .env.example at runtime.

# --- dependencies ----------------------------------------------------------
FROM node:22-alpine AS deps
# Prisma's query engine needs OpenSSL.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build -----------------------------------------------------------------
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Placeholder product images are generated at build time rather than on boot:
# they are deterministic, and baking them into the image means the container
# needs no writable disk to show a populated catalogue.
RUN npx tsx scripts/generate-images.ts

# `next build` runs `prisma generate` first (see package.json).
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runtime ---------------------------------------------------------------
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Run as a non-root user.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# The standalone bundle, plus the assets it does not trace.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# The STOCK folder is the product source for the local storage provider, and
# carries the generated placeholder images.
COPY --from=builder --chown=nextjs:nodejs /app/stock ./stock

# Migrations, schema and the CLI scripts, so `prisma migrate deploy`,
# `db:seed` and `admin:create` can be run against the deployed container.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/tsx ./node_modules/tsx

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
