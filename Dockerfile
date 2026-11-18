FROM node:20-bookworm-slim

# Install build tools for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all package files
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm install

# Copy all source
COPY . .

# Build frontend
RUN npm run build --workspace=frontend

# Generate Prisma client
RUN npm run prisma:generate --workspace=backend

# Compile backend TypeScript
RUN npm run build --workspace=backend

EXPOSE 4000

# Run db push then start server
CMD ["sh", "-c", "cd backend && npx prisma db push --skip-generate && cd /app && node backend/dist/index.js"]
