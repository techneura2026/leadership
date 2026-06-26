#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo "============================================================"
echo " LeaderPrism Local Dev Startup Script (Linux)"
echo "============================================================"

# 1. Clean up ports
echo ""
echo "[1/7] Cleaning up local ports: 3000 (Web), 3001 (API), 5432 (Postgres), 6379 (Redis)..."
for port in 3000 3001 5432 6379; do
  # Kill any process holding these ports
  fuser -k ${port}/tcp 2>/dev/null
done

# 2. Check and copy env files
echo ""
echo "[2/7] Checking environment files..."
if [ ! -f ".env" ]; then
    echo ".env not found at root, copying from .env.example..."
    cp .env.example .env 2>/dev/null
else
    echo ".env exists at root."
fi

if [ ! -f "api/.env" ]; then
    echo "api/.env not found, copying from api/.env.example..."
    cp api/.env.example api/.env 2>/dev/null
else
    echo "api/.env exists."
fi

if [ ! -f "web/.env.local" ]; then
    echo "web/.env.local not found, copying from web/.env.example..."
    cp web/.env.example web/.env.local 2>/dev/null
else
    echo "web/.env.local exists."
fi

# 3. Check and install dependencies
echo ""
echo "[3/7] Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "node_modules not found, running npm install..."
    npm install
else
    echo "node_modules folder exists."
fi

# 4. Clean up Docker
echo ""
echo "[4/7] Cleaning up existing Docker containers and volumes..."
docker compose down -v
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Warning: docker compose down failed. Attempting to continue...${NC}"
fi

# 5. Start Database and Redis
echo ""
echo "[5/7] Starting Database and Redis containers..."
docker compose up db redis -d
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to start docker containers!${NC}"
    exit 1
fi

# 6. Wait for Database and Redis to be ready
echo ""
echo "[6/7] Waiting for Database (5432) and Redis (6379) ports to be ready..."
for port in 5432 6379; do
    ready=false
    attempts=0
    while [ "$ready" = false ] && [ $attempts -lt 30 ]; do
        # nc (netcat) checks if the port is actively listening
        if nc -z localhost $port 2>/dev/null; then
            ready=true
            echo -e "${GREEN}Port $port is active and listening.${NC}"
        else
            attempts=$((attempts+1))
            sleep 1
        fi
    done
    if [ "$ready" = false ]; then
        echo -e "${RED}Error: Port $port did not become active in time.${NC}"
        exit 1
    fi
done

# Give PostgreSQL container extra 3 seconds to complete running init.sql
echo "Waiting a brief moment for database initialization..."
sleep 3

# 7. Build shared library, run migrations and seeds
echo ""
echo "[7/7] Building shared library and initializing database..."

echo "Building shared library..."
npm run build -w shared
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to build shared library!${NC}"
    exit 1
fi

echo "Running database migrations..."
npm run db:migrate
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Database migrations failed!${NC}"
    exit 1
fi

echo "Running database seeds..."
npm run db:seed
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Database seeding failed!${NC}"
    exit 1
fi

echo ""
echo "============================================================"
echo -e "${GREEN}🚀 Setup complete! Starting development servers...${NC}"
echo "============================================================"
echo ""

npm run dev