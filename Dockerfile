FROM node:26-slim

WORKDIR /app

# Install dependencies for LibreOffice and PDF conversion
# - libreoffice: for PPTX to PDF conversion
# - poppler-utils: for PDF to image conversion (pdftoppm)
# - fonts-dejavu, fonts-liberation: for proper text rendering
# - wget, curl: for health checks and API communication
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-impress \
    poppler-utils \
    fonts-dejavu \
    fonts-liberation \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application files
COPY backend ./backend
COPY public ./public

# Create directories
RUN mkdir -p /app/data /app/uploads /app/slides /app/assets

# Expose port
EXPOSE 3000

# Start application directly with node (not npm) to properly handle SIGTERM
CMD ["node", "backend/server.js"]
