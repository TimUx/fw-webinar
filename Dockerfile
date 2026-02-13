FROM node:20-slim

WORKDIR /app

# Install dependencies for PDF/PPTX conversion
# - poppler-utils: for PDF to image conversion (pdftoppm)
# - libreoffice: for PPTX to PDF conversion
# - fonts-dejavu: for proper text rendering in conversions
# - wget: for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libreoffice \
    libreoffice-writer \
    libreoffice-impress \
    fonts-dejavu \
    wget \
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
