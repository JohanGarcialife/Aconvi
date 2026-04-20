########################################
# Stage 1: Install dependencies
########################################
FROM node:22-alpine AS deps
WORKDIR /app

# Install pnpm via npm (reliable, stays in PATH within same RUN)
RUN npm install -g pnpm@10.19.0

# Copy only manifest files first (for layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo/ ./turbo/
COPY tooling/ ./tooling/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY packages/api/package.json ./packages/api/
COPY packages/ui/package.json ./packages/ui/
COPY packages/validators/package.json ./packages/validators/
COPY apps/nextjs/package.json ./apps/nextjs/

# Install all dependencies with workspace protocol support
RUN pnpm install --frozen-lockfile

########################################
# Stage 2: Build the Next.js app
########################################
FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@10.19.0

# Copy everything including node_modules
COPY --from=deps /app ./

# Copy source code
COPY packages/ ./packages/
COPY apps/nextjs/ ./apps/nextjs/
COPY tooling/ ./tooling/
COPY turbo.json ./turbo.json
COPY turbo/ ./turbo/

# Build only the Next.js app — packages are transpiled directly by Next.js
# SKIP_ENV_VALIDATION prevents env schema errors during docker build
# NODE_OPTIONS limits memory usage to prevent OOM on limited RAM VPS
ENV SKIP_ENV_VALIDATION=1
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN cd apps/nextjs && pnpm run build

########################################
# Stage 3: Production runtime
########################################
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy standalone output from Next.js
COPY --from=builder /app/apps/nextjs/.next/standalone ./
COPY --from=builder /app/apps/nextjs/.next/static ./apps/nextjs/.next/static
COPY --from=builder /app/apps/nextjs/public ./apps/nextjs/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/nextjs/server.js"]
