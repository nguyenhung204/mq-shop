# syntax=docker/dockerfile:1

# ---------- deps ----------
# Install dependencies in an isolated layer so they're cached
# unless package.json / package-lock.json change.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder ----------
# Build the Next.js app. Requires next.config.ts to have `output: "standalone"`.
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public build-time env vars (baked into the client bundle).
# Pass with: docker build --build-arg NEXT_PUBLIC_API_HOST=https://api.example.com .
ARG NEXT_PUBLIC_API_HOST
ENV NEXT_PUBLIC_API_HOST=https://api.mqplaza.com

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runner ----------
# Minimal runtime image: only the standalone server output + static assets.
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
