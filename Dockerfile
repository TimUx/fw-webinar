FROM node:20-slim

WORKDIR /app

# Install dependencies for PDF/PPTX conversion and Playwright
# - poppler-utils: for PDF to image conversion (pdftoppm)
# - libreoffice: for PPTX to PDF conversion
# - fonts-dejavu: for proper text rendering in conversions
# - wget: for health checks
# - curl: for API communication
# Playwright dependencies (for headless browser rendering)
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libreoffice \
    libreoffice-impress \
    fonts-dejavu \
    fonts-liberation \
    wget \
    curl \
    # Playwright browser dependencies
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
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Install Playwright browsers
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
