#!/bin/bash
# Script to retrieve OnlyOffice JWT Secret from container
# This script checks the OnlyOffice DocumentServer configuration for the JWT secret

set -e

# Try common container names if none specified
if [ -z "$1" ]; then
    # Check which container name exists
    if docker ps --format '{{.Names}}' | grep -q "^webinar-onlyoffice$"; then
        CONTAINER_NAME="webinar-onlyoffice"
    elif docker ps --format '{{.Names}}' | grep -q "^fw-webinar-onlyoffice$"; then
        CONTAINER_NAME="fw-webinar-onlyoffice"
    else
        echo "❌ Error: No OnlyOffice container found"
        echo "   Expected container name: webinar-onlyoffice or fw-webinar-onlyoffice"
        echo "   Check running containers with: docker ps"
        echo "   Start it with: docker-compose up -d onlyoffice"
        exit 1
    fi
else
    CONTAINER_NAME="$1"
fi

echo "🔍 Retrieving JWT secret from OnlyOffice container: $CONTAINER_NAME"
echo ""

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Error: Container '$CONTAINER_NAME' is not running"
    echo "   Start it with: docker-compose up -d onlyoffice"
    exit 1
fi

echo "Checking OnlyOffice configuration files..."
echo ""

# OnlyOffice stores JWT configuration in /etc/onlyoffice/documentserver/local.json
# The JWT secret is generated at container startup if not provided

# Method 1: Check local.json file
echo "Method 1: Checking local.json configuration file..."
if docker exec "$CONTAINER_NAME" test -f /etc/onlyoffice/documentserver/local.json 2>/dev/null; then
    SECRET=$(docker exec "$CONTAINER_NAME" cat /etc/onlyoffice/documentserver/local.json 2>/dev/null | grep -oP '"secret"\s*:\s*"\K[^"]+' | head -1)
    
    if [ -n "$SECRET" ] && [ "$SECRET" != "secret" ]; then
        echo "✅ JWT Secret found in local.json:"
        echo ""
        echo "   $SECRET"
        echo ""
        echo "📋 Add this to your .env file:"
        echo "   ONLYOFFICE_JWT_SECRET=$SECRET"
        echo ""
        echo "🔄 Then restart the backend:"
        echo "   docker-compose restart backend"
        exit 0
    fi
fi

# Method 2: Check default.json file
echo "Method 2: Checking default.json configuration file..."
if docker exec "$CONTAINER_NAME" test -f /etc/onlyoffice/documentserver/default.json 2>/dev/null; then
    SECRET=$(docker exec "$CONTAINER_NAME" cat /etc/onlyoffice/documentserver/default.json 2>/dev/null | grep -oP '"secret"\s*:\s*"\K[^"]+' | head -1)
    
    if [ -n "$SECRET" ] && [ "$SECRET" != "secret" ]; then
        echo "✅ JWT Secret found in default.json:"
        echo ""
        echo "   $SECRET"
        echo ""
        echo "📋 Add this to your .env file:"
        echo "   ONLYOFFICE_JWT_SECRET=$SECRET"
        echo ""
        echo "🔄 Then restart the backend:"
        echo "   docker-compose restart backend"
        exit 0
    fi
fi

# Method 3: Check environment variables
echo "Method 3: Checking environment variables..."
SECRET=$(docker exec "$CONTAINER_NAME" printenv JWT_SECRET 2>/dev/null || echo "")

if [ -n "$SECRET" ] && [ "$SECRET" != "secret" ]; then
    echo "✅ JWT Secret found in environment:"
    echo ""
    echo "   $SECRET"
    echo ""
    echo "📋 Add this to your .env file:"
    echo "   ONLYOFFICE_JWT_SECRET=$SECRET"
    echo ""
    echo "🔄 Then restart the backend:"
    echo "   docker-compose restart backend"
    exit 0
fi

# If we get here, no valid secret was found
echo "⚠️  No JWT secret found or using default 'secret'"
echo ""
echo "Options:"
echo ""
echo "1. Generate a new JWT secret and configure OnlyOffice:"
echo "   SECRET=\$(openssl rand -hex 32)"
echo "   echo \"ONLYOFFICE_JWT_SECRET=\$SECRET\" >> .env"
echo "   docker-compose down"
echo "   docker-compose up -d"
echo ""
echo "2. Disable JWT (not recommended for production):"
echo "   Note: Even with JWT_ENABLED=false, OnlyOffice may still require JWT for the conversion API"
echo ""
echo "For more information, check the OnlyOffice documentation:"
echo "https://api.onlyoffice.com/editors/signature/"
