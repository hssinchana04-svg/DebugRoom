# Use Debian Bullseye — required for node-pty native compilation
FROM node:20-bullseye-slim

# Install build tools for native modules (node-pty needs python, make, g++)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files (monorepo workspaces)
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Install ALL dependencies (including devDependencies for building)
RUN npm install --workspace=backend

# Copy backend source
COPY backend/ ./backend/

# Generate Prisma client
RUN npm run prisma:generate --workspace=backend

# Compile TypeScript
RUN npm run build --workspace=backend

EXPOSE 4000

# Run migrations then start the server
CMD ["sh", "-c", "cd backend && npx prisma migrate deploy && cd /app && node backend/dist/index.js"]
