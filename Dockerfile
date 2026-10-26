# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN npm run build

# Production stage
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy necessary files from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
# services.json is read at runtime (so it can also be bind-mounted)
COPY --from=builder /app/src/data ./src/data
# Audio for the Sounds widget; mount a volume here to keep it across rebuilds
RUN mkdir -p data/sounds

EXPOSE 3000

# Run Next.js in production mode
CMD ["npx", "next", "start"]
