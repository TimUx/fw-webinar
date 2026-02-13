FROM node:20-slim

WORKDIR /app

# Install dependencies for Playwright and PDF conversion
# - poppler-utils: for PDF to image conversion (pdftoppm) - still needed for PDF imports
# - fonts-dejavu, fonts-liberation: for proper text rendering
# - wget, curl: for health checks and API communication
# Playwright browser dependencies (Chromium)
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    fonts-dejavu \
    fonts-liberation \
    wget \
    curl \
    # Playwright Chromium dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Install Playwright browsers (Chromium only for smaller image size)
RUN npx playwright install chromium --with-deps

# Copy application files
COPY backend ./backend
COPY public ./public

# Create directories
RUN mkdir -p /app/data /app/uploads /app/slides /app/assets

# Expose port
EXPOSE 3000

# Start application directly with node (not npm) to properly handle SIGTERM
CMD ["node", "backend/server.js"]
