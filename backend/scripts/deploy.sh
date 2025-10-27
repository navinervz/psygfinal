#!/bin/bash

# PSYGStore Backend Deployment Script
set -e

echo "🚀 Starting PSYGStore Backend Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the backend directory"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed. Installing..."
    npm install -g pm2
fi

print_status "Installing dependencies..."
npm ci --only=production

print_status "Building TypeScript..."
npm run build

print_status "Running database migrations..."
npx prisma generate
npx prisma db push

print_status "Creating necessary directories..."
mkdir -p logs
mkdir -p uploads

print_status "Setting up PM2..."
if pm2 list | grep -q "psygstore-backend"; then
    print_status "Restarting existing PM2 process..."
    pm2 restart psygstore-backend
else
    print_status "Starting new PM2 process..."
    pm2 start ecosystem.config.js
fi

pm2 save

print_status "Setting up log rotation..."
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

print_status "Running health check..."
sleep 5
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    print_status "✅ Backend is running successfully!"
else
    print_error "❌ Backend health check failed"
    pm2 logs psygstore-backend --lines 20
    exit 1
fi

print_status "Deployment completed successfully! 🎉"
echo ""
echo "📊 Backend Status:"
pm2 status
echo ""
echo "📝 Useful Commands:"
echo "  pm2 logs psygstore-backend    # View logs"
echo "  pm2 restart psygstore-backend # Restart backend"
echo "  pm2 stop psygstore-backend    # Stop backend"
echo "  pm2 monit                     # Monitor processes"