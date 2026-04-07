# Multi-stage Docker build for Node.js TypeScript application

# Stage 1: Build stage
FROM node:22.14.0-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY appbackend/library-service/package.json appbackend/library-service/yarn.lock ./
COPY appbackend/library-service/.yarnrc.yml ./

# Install dependencies (including devDependencies for build)
RUN yarn install --frozen-lockfile

# Copy source code and configuration files
COPY appbackend/library-service/tsconfig.json ./
COPY appbackend/library-service/tsconfig.build.json ./
COPY appbackend/library-service/package-scripts.js ./
COPY appbackend/library-service/eslint.config.js ./
COPY appbackend/library-service/.prettierrc ./
COPY appbackend/library-service/commands/ ./commands/
COPY appbackend/library-service/src/ ./src/

# Build the application
RUN yarn build

# Stage 2: Production stage
FROM node:22.14.0-alpine AS production

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

ARG ENV

# Set working directory
WORKDIR /app

# Copy package files
COPY appbackend/library-service/package.json appbackend/library-service/yarn.lock ./
COPY appbackend/library-service/.yarnrc.yml ./

# Install only production dependencies
RUN yarn install --frozen-lockfile && \
    yarn cache clean

# Copy built application from builder stage
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist

# Copy nps configuration for yarn start
COPY --from=builder --chown=nodeuser:nodejs /app/package-scripts.js ./

# Copy production environment file
COPY --chown=nodeuser:nodejs appbackend/library-service/.env.${ENV} ./.env

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs && chown nodeuser:nodejs /app/logs

# Switch to non-root user
USER nodeuser

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application
CMD ["yarn", "start"]
