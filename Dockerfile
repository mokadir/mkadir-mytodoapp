# =============================================================================
# Todo App — Multi-stage Docker Build
# Docker Hub: mokadir/todoapp
# =============================================================================

# ─── Build Stage: Client ──────────────────────────────────────────────────────
FROM node:22-alpine AS client-build

WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ─── Build Stage: Server ──────────────────────────────────────────────────────
FROM node:22-alpine AS server-build

WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/ ./
RUN npx prisma generate
RUN npm run build

# ─── Production Stage ──────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy server build
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=server-build /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/package.json ./server/
COPY --from=server-build /app/server/prisma ./server/prisma

# Copy client build
COPY --from=client-build /app/client/dist ./client/dist

# Create non-root user with fixed UID 1000 (matches hostPath PV ownership)
# Note: node:22-alpine base image already has 'node' user with UID/GID 1000,
# so we use GID 1001 for our appgroup to avoid conflict
RUN addgroup -S -g 1001 appgroup && adduser -S -u 1000 -G appgroup appuser

# Create data directory for SQLite database and set permissions
RUN mkdir -p /app/server/prisma/data && chown -R appuser:appgroup /app

USER appuser

# Environment
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start server (which also serves client static files in production)
CMD ["dumb-init", "node", "server/dist/index.js"]

