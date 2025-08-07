FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml*  ./
RUN npm i

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Build-time arguments for Next.js client-side embedding
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL
ARG NEXT_PUBLIC_WS_CHAT_COMPLETION_URL
ARG NEXT_PUBLIC_WEB_SOCKET_DEFAULT_ON
ARG NEXT_PUBLIC_DOCS_URL

# Set environment variables for the build (only if provided)
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL=$NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL
ENV NEXT_PUBLIC_WS_CHAT_COMPLETION_URL=$NEXT_PUBLIC_WS_CHAT_COMPLETION_URL
ENV NEXT_PUBLIC_WEB_SOCKET_DEFAULT_ON=$NEXT_PUBLIC_WEB_SOCKET_DEFAULT_ON
ENV NEXT_PUBLIC_DOCS_URL=$NEXT_PUBLIC_DOCS_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN apk update
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Default server configuration
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Runtime environment variables (can be overridden at deployment)
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/next.config.* ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

EXPOSE 3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"] 