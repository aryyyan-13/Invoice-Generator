# ── Invoice Generator Dockerfile ──────────────────────
# Multi-stage build: installs Chromium for Puppeteer,
# builds the React frontend, and runs the Express server.

FROM node:20-slim

# Install Chromium dependencies required by Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    wget \
    xdg-utils \
    chromium \
  && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files and install root dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy frontend package files and install frontend dependencies
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm --prefix frontend ci

# Copy the entire project
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the React frontend for production
RUN npm run build:frontend

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose the application port
EXPOSE 3001

# Start: push schema to DB (creates tables if needed) then run server
CMD npx prisma db push --skip-generate && node server.js
