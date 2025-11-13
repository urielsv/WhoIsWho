# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (including dev) for building
# Use npm ci for faster, reproducible builds if lock file exists
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source code
COPY . .

# Build the application in production mode
ENV NODE_ENV=production
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy package files for installing production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./

# Install only production dependencies (needed for server.mjs)
# Install as root, then change ownership
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --production; fi && \
    chown -R nextjs:nodejs /app/node_modules

# Copy necessary files from builder
# Next.js standalone output includes Next.js dependencies
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy server.mjs (required for custom server)
COPY --from=builder --chown=nextjs:nodejs /app/server.mjs ./server.mjs

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Use the server.mjs from the root
CMD ["node", "server.mjs"]

