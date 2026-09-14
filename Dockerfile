# ============================================
# DOCKERFILE - MiChambita Backend (NestJS)
# Multi-stage build for production deployment
# ============================================

# Stage 1: Dependencies
FROM node:24-alpine AS deps
WORKDIR /app

# Toolchain para módulos nativos (bcrypt, pdfkit, pg)
RUN apk add --no-cache python3 make g++ libc6-compat

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# Copy package files (pnpm-workspace.yaml contiene los overrides referenciados en el lockfile)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies (shamefully-hoist for flat node_modules structure)
RUN pnpm install --frozen-lockfile --shamefully-hoist

# ============================================
# Stage 2: Builder
FROM node:24-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN pnpm run build

# ============================================
# Stage 3: Production Runner
FROM node:24-alpine AS runner
WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy necessary files from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json

# Create uploads directory
RUN mkdir -p ./uploads && chown -R nestjs:nodejs ./uploads

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# Start the application
CMD ["node", "dist/src/main.js"]
