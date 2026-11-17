FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all package files
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install all dependencies
RUN npm install

# Copy all source
COPY . .

# Build frontend (no VITE_API_URL = uses same origin automatically)
RUN npm run build --workspace=frontend

# Generate Prisma client
RUN npm run prisma:generate --workspace=backend

# Compile backend TypeScript
RUN npm run build --workspace=backend

EXPOSE 4000

# Run migrations then start — Express serves both API and frontend
CMD ["sh", "-c", "cd backend && npx prisma db push --skip-generate && cd /app && node backend/dist/index.js"]
