#!/bin/bash

# PSYGStore Backend Backup Script
set -e

BACKUP_DIR="/var/backups/psygstore"
DATE=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="/var/www/psygstore.com/backend"

# Database credentials from .env
DB_HOST="localhost"
DB_NAME="xsblbatq_psygstore"
DB_USER="xsblbatq_psygstore"
DB_PASS="Sample@369963"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
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

print_status "Starting backup process..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
print_status "Creating database backup..."
if mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/db_$DATE.sql; then
    print_status "Database backup created: db_$DATE.sql"
    
    # Compress database backup
    gzip $BACKUP_DIR/db_$DATE.sql
    print_status "Database backup compressed"
else
    print_error "Database backup failed!"
    exit 1
fi

# Backend files backup
print_status "Creating backend files backup..."
if tar -czf $BACKUP_DIR/backend_$DATE.tar.gz \
    --exclude="$PROJECT_DIR/node_modules" \
    --exclude="$PROJECT_DIR/dist" \
    --exclude="$PROJECT_DIR/logs" \
    --exclude="$PROJECT_DIR/coverage" \
    --exclude="$PROJECT_DIR/.git" \
    $PROJECT_DIR; then
    print_status "Backend files backup created: backend_$DATE.tar.gz"
else
    print_error "Backend files backup failed!"
    exit 1
fi

# Logs backup
print_status "Creating logs backup..."
if [ -d "$PROJECT_DIR/logs" ]; then
    tar -czf $BACKUP_DIR/logs_$DATE.tar.gz $PROJECT_DIR/logs/
    print_status "Logs backup created: logs_$DATE.tar.gz"
fi

# Environment backup (without sensitive data)
print_status "Creating environment backup..."
if [ -f "$PROJECT_DIR/.env" ]; then
    # Create sanitized env backup (remove sensitive values)
    sed 's/=.*/=***REDACTED***/g' $PROJECT_DIR/.env > $BACKUP_DIR/env_$DATE.txt
    print_status "Environment backup created (sanitized)"
fi

# Clean old backups (keep last 7 days)
print_status "Cleaning old backups..."
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.txt" -mtime +7 -delete

# Calculate backup sizes
DB_SIZE=$(du -h $BACKUP_DIR/db_$DATE.sql.gz | cut -f1)
BACKEND_SIZE=$(du -h $BACKUP_DIR/backend_$DATE.tar.gz | cut -f1)

print_status "Backup completed successfully!"
echo "Database backup size: $DB_SIZE"
echo "Backend backup size: $BACKEND_SIZE"
echo "Backup location: $BACKUP_DIR"

# Optional: Send notification
# curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/sendMessage" \
#      -d "chat_id=<ADMIN_CHAT_ID>" \
#      -d "text=✅ PSYGStore backup completed successfully at $(date)"

exit 0