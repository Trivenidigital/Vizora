# ---- Build stage ----
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json ./
COPY web/package.json web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY web/ web/

# Build Next.js
RUN npx nx build @vizora/web

# ---- Production stage ----
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone Next.js output
COPY --from=builder /app/web/.next/standalone ./
COPY --from=builder /app/web/.next/static ./.next/static
COPY --from=builder /app/web/public ./public

EXPOSE 3001

USER node

CMD ["node", "server.js"]
