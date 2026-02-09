# ---- Build stage ----
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json ./
COPY realtime/package.json realtime/
COPY packages/database/package.json packages/database/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY realtime/ realtime/
COPY packages/database/ packages/database/

# Generate Prisma client and build
RUN pnpm --filter @vizora/database db:generate
RUN npx nx build @vizora/realtime

# ---- Production stage ----
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV NODE_ENV=production

# Copy built output and production dependencies
COPY --from=builder /app/realtime/dist ./dist
COPY --from=builder /app/realtime/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

EXPOSE 3002

USER node

CMD ["node", "dist/main.js"]
