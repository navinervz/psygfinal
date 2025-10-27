#!/bin/bash

# Database backup
echo "Creating database backup..."
ssh user@your-server "pg_dump psygstore > /var/www/html/psygstore.com/backup/db-$(date +%Y%m%d-%H%M%S).sql"

# Files backup
echo "Creating files backup..."
ssh user@your-server "cd /var/www/html/psygstore.com && tar -czf backup/files-$(date +%Y%m%d-%H%M%S).tar.gz public_html"

# Keep only last 7 days of backups
echo "Cleaning old backups..."
ssh user@your-server "find /var/www/html/psygstore.com/backup -mtime +7 -type f -delete"

echo "Backup completed successfully!"