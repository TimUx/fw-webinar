#!/bin/bash
# Test script for OnlyOffice configuration
# This script verifies that the OnlyOffice container starts correctly without EBUSY errors

set -e

echo "=========================================="
echo "OnlyOffice Configuration Test"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if docker-compose is available
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo -e "${RED}❌ Neither docker-compose nor docker compose is available${NC}"
    exit 1
fi

echo "Using: $COMPOSE_CMD"
echo ""

# Step 1: Stop existing containers
echo "Step 1: Stopping existing containers..."
$COMPOSE_CMD down || true
echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

# Step 2: Start containers
echo "Step 2: Starting containers..."
$COMPOSE_CMD up -d
echo -e "${GREEN}✓ Containers started${NC}"
echo ""

# Step 3: Wait for OnlyOffice to initialize
echo "Step 3: Waiting for OnlyOffice to initialize (this may take 2-3 minutes)..."
sleep 10
echo -e "${YELLOW}Waiting...${NC}"

# Check for EBUSY errors in OnlyOffice logs
echo ""
echo "Step 4: Checking OnlyOffice logs for EBUSY errors..."
EBUSY_COUNT=$($COMPOSE_CMD logs onlyoffice 2>&1 | grep -c "EBUSY" || true)

if [ "$EBUSY_COUNT" -gt 0 ]; then
    echo -e "${RED}❌ FOUND $EBUSY_COUNT EBUSY error(s) in OnlyOffice logs${NC}"
    echo ""
    echo "Last 30 lines of OnlyOffice logs:"
    $COMPOSE_CMD logs --tail=30 onlyoffice
    exit 1
else
    echo -e "${GREEN}✓ No EBUSY errors found${NC}"
fi
echo ""

# Step 5: Check OnlyOffice container status
echo "Step 5: Checking OnlyOffice container status..."
CONTAINER_STATUS=$($COMPOSE_CMD ps onlyoffice --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

if [ "$CONTAINER_STATUS" == "running" ]; then
    echo -e "${GREEN}✓ OnlyOffice container is running${NC}"
elif [ "$CONTAINER_STATUS" == "restarting" ]; then
    echo -e "${RED}❌ OnlyOffice container is restarting (possible crash loop)${NC}"
    echo ""
    echo "Last 50 lines of OnlyOffice logs:"
    $COMPOSE_CMD logs --tail=50 onlyoffice
    exit 1
else
    echo -e "${YELLOW}⚠ OnlyOffice container status: $CONTAINER_STATUS${NC}"
fi
echo ""

# Step 6: Wait for health check
echo "Step 6: Waiting for OnlyOffice health check to pass..."
MAX_WAIT=180  # 3 minutes
WAIT_TIME=0
HEALTH_STATUS="starting"

while [ "$WAIT_TIME" -lt "$MAX_WAIT" ]; do
    HEALTH_STATUS=$($COMPOSE_CMD ps onlyoffice --format json 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    
    if [ "$HEALTH_STATUS" == "healthy" ]; then
        echo -e "${GREEN}✓ OnlyOffice is healthy${NC}"
        break
    elif [ "$HEALTH_STATUS" == "unhealthy" ]; then
        echo -e "${RED}❌ OnlyOffice health check failed${NC}"
        break
    fi
    
    if [ $((WAIT_TIME % 15)) -eq 0 ]; then
        echo -e "${YELLOW}Still waiting... (${WAIT_TIME}s / ${MAX_WAIT}s)${NC}"
    fi
    
    sleep 5
    WAIT_TIME=$((WAIT_TIME + 5))
done

if [ "$HEALTH_STATUS" != "healthy" ]; then
    echo -e "${YELLOW}⚠ Health status: $HEALTH_STATUS (may still be initializing)${NC}"
fi
echo ""

# Step 7: Check if OnlyOffice is accessible
echo "Step 7: Testing OnlyOffice HTTP endpoint..."
HTTP_STATUS=$(docker exec webinar-backend curl -s -o /dev/null -w "%{http_code}" http://onlyoffice/healthcheck 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}✓ OnlyOffice HTTP endpoint is accessible (HTTP 200)${NC}"
elif [ "$HTTP_STATUS" == "000" ]; then
    echo -e "${RED}❌ Cannot connect to OnlyOffice endpoint${NC}"
else
    echo -e "${YELLOW}⚠ OnlyOffice returned HTTP $HTTP_STATUS${NC}"
fi
echo ""

# Step 8: Check environment variables
echo "Step 8: Checking OnlyOffice environment variables..."
PRIVATE_IP_ALLOWED=$(docker exec webinar-onlyoffice printenv DS_ALLOW_PRIVATE_IP_ADDRESS 2>/dev/null || echo "NOT_SET")
META_IP_ALLOWED=$(docker exec webinar-onlyoffice printenv DS_ALLOW_META_IP_ADDRESS 2>/dev/null || echo "NOT_SET")

echo "DS_ALLOW_PRIVATE_IP_ADDRESS: $PRIVATE_IP_ALLOWED"
echo "DS_ALLOW_META_IP_ADDRESS: $META_IP_ALLOWED"

if [ "$PRIVATE_IP_ALLOWED" == "true" ]; then
    echo -e "${GREEN}✓ Private IP addresses are allowed${NC}"
else
    echo -e "${YELLOW}⚠ Private IP addresses may not be allowed${NC}"
fi

if [ "$META_IP_ALLOWED" == "true" ]; then
    echo -e "${GREEN}✓ Metadata IP addresses are allowed${NC}"
else
    echo -e "${YELLOW}⚠ Metadata IP addresses may not be allowed${NC}"
fi
echo ""

# Step 9: Check JWT configuration
echo "Step 9: Checking JWT configuration..."
JWT_SECRET_SET=$(docker exec webinar-onlyoffice printenv JWT_SECRET 2>/dev/null | wc -c)

if [ "$JWT_SECRET_SET" -gt 1 ]; then
    echo -e "${GREEN}✓ JWT_SECRET environment variable is set${NC}"
else
    echo -e "${YELLOW}⚠ JWT_SECRET environment variable is not set (OnlyOffice will generate one)${NC}"
    echo -e "${YELLOW}  Run: ./get-onlyoffice-jwt-secret.sh to retrieve it${NC}"
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
if [ "$EBUSY_COUNT" -eq 0 ] && [ "$CONTAINER_STATUS" == "running" ]; then
    echo -e "${GREEN}✅ OnlyOffice configuration test PASSED${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Retrieve JWT secret: ./get-onlyoffice-jwt-secret.sh"
    echo "2. Add ONLYOFFICE_JWT_SECRET to .env file"
    echo "3. Restart backend: $COMPOSE_CMD restart backend"
    echo "4. Test PPTX upload in admin panel"
    exit 0
else
    echo -e "${RED}❌ OnlyOffice configuration test FAILED${NC}"
    echo ""
    echo "Please check the logs above for errors."
    exit 1
fi
