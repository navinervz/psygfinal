#!/bin/bash

# PSYGStore Advanced Monitoring Script
# This script provides comprehensive monitoring and alerting

PROJECT_DIR="/var/www/psygstore.com/backend"
LOG_DIR="$PROJECT_DIR/logs"
MONITORING_LOG="/var/log/psygstore-monitoring.log"
ALERT_THRESHOLD_FILE="/tmp/psygstore-alerts.tmp"

# Configuration
# Load from environment or use defaults
MAX_RESPONSE_TIME=${MAX_RESPONSE_TIME:-5000}
MIN_FREE_DISK=${MIN_FREE_DISK:-10}
MIN_FREE_MEMORY=${MIN_FREE_MEMORY:-10}
MAX_LOG_SIZE=${MAX_LOG_SIZE:-500}
SSL_WARNING_DAYS=${SSL_WARNING_DAYS:-30}
SSL_CRITICAL_DAYS=${SSL_CRITICAL_DAYS:-7}
DB_SLOW_QUERY_THRESHOLD=${DB_SLOW_QUERY_THRESHOLD:-3000}
API_TIMEOUT_THRESHOLD=${API_TIMEOUT_THRESHOLD:-10000}
HIGH_ERROR_COUNT_THRESHOLD=${HIGH_ERROR_COUNT_THRESHOLD:-50}
DISK_CRITICAL_THRESHOLD=${DISK_CRITICAL_THRESHOLD:-90}
MEMORY_CRITICAL_THRESHOLD=${MEMORY_CRITICAL_THRESHOLD:-90}
CPU_WARNING_THRESHOLD=${CPU_WARNING_THRESHOLD:-80}
CPU_CRITICAL_THRESHOLD=${CPU_CRITICAL_THRESHOLD:-90}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log_monitoring() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $MONITORING_LOG
}

# Alert function (can be extended for Telegram/Email)
send_alert() {
    local severity="$1"
    local message="$2"
    local alert_key="$3"
    
    # Prevent spam alerts (same alert within 1 hour)
    if [ -f "$ALERT_THRESHOLD_FILE" ] && grep -q "$alert_key" "$ALERT_THRESHOLD_FILE"; then
        local last_alert=$(grep "$alert_key" "$ALERT_THRESHOLD_FILE" | cut -d: -f2)
        local current_time=$(date +%s)
        local time_diff=$((current_time - last_alert))
        
        if [ $time_diff -lt 3600 ]; then  # 1 hour
            return 0  # Skip duplicate alert
        fi
    fi
    
    log_monitoring "[$severity] $message"
    
    # Update alert threshold file
    grep -v "$alert_key" "$ALERT_THRESHOLD_FILE" 2>/dev/null > "${ALERT_THRESHOLD_FILE}.tmp" || true
    echo "$alert_key:$(date +%s)" >> "${ALERT_THRESHOLD_FILE}.tmp"
    mv "${ALERT_THRESHOLD_FILE}.tmp" "$ALERT_THRESHOLD_FILE"
    
    # TODO: Implement actual alerting (Telegram, Email, etc.)
    case $severity in
        "CRITICAL")
            echo -e "${RED}🚨 CRITICAL ALERT: $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  WARNING: $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  INFO: $message${NC}"
            ;;
    esac
    
    # Call Node.js alert service if backend is running
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        curl -s -X POST http://localhost:3000/api/admin/alerts \
             -H "Content-Type: application/json" \
             -H "Authorization: Bearer $ADMIN_API_TOKEN" \
             -d "{\"severity\":\"$severity\",\"title\":\"Health Check Alert\",\"message\":\"$message\",\"source\":\"health-check\"}" > /dev/null 2>&1 || true
    fi
}

# Performance monitoring
monitor_performance() {
    log_monitoring "Starting performance monitoring..."
    
    # API Response time check
    local start_time=$(date +%s%3N)
    local response=$(curl -s -w "%{http_code}:%{time_total}" http://localhost:3000/health -o /dev/null)
    local end_time=$(date +%s%3N)
    
    local http_code=$(echo $response | cut -d: -f1)
    local response_time_seconds=$(echo $response | cut -d: -f2)
    local response_time_ms=$(echo "$response_time_seconds * 1000" | bc -l | cut -d. -f1)
    
    if [ "$http_code" != "200" ]; then
        send_alert "CRITICAL" "API health check failed (HTTP: $http_code)" "api_down"
        return 1
    fi
    
    if [ "$response_time_ms" -gt "$MAX_RESPONSE_TIME" ]; then
        send_alert "WARNING" "API response time high: ${response_time_ms}ms" "slow_response"
    fi
    
    echo -e "${GREEN}✅ API Response Time: ${response_time_ms}ms${NC}"
    log_monitoring "API response time: ${response_time_ms}ms"
}

# Database monitoring
monitor_database() {
    log_monitoring "Checking database performance..."
    
    # Connection test with timeout
    local db_start=$(date +%s%3N)
    if timeout 10 mysql -h localhost -u xsblbatq_psygstore -pSample@369963 \
        -e "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM orders;" \
        xsblbatq_psygstore > /tmp/db_check.out 2>&1; then
        
        local db_end=$(date +%s%3N)
        local db_time=$((db_end - db_start))
        
        echo -e "${GREEN}✅ Database: Connected (${db_time}ms)${NC}"
        log_monitoring "Database connection time: ${db_time}ms"
        
        # Check table counts
        local user_count=$(grep -A1 "COUNT" /tmp/db_check.out | head -2 | tail -1)
        local order_count=$(grep -A1 "COUNT" /tmp/db_check.out | tail -1)
        
        log_monitoring "Database stats - Users: $user_count, Orders: $order_count"
        
    else
        send_alert "CRITICAL" "Database connection failed" "db_down"
        return 1
    fi
    
    # Check database size
    local db_size=$(mysql -h localhost -u xsblbatq_psygstore -pSample@369963 \
        -e "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS 'DB Size in MB' FROM information_schema.tables WHERE table_schema='xsblbatq_psygstore';" \
        --skip-column-names 2>/dev/null || echo "0")
    
    if [ "$db_size" != "0" ]; then
        echo -e "${GREEN}📊 Database Size: ${db_size}MB${NC}"
        log_monitoring "Database size: ${db_size}MB"
    fi
    
    rm -f /tmp/db_check.out
}

# Process monitoring
monitor_processes() {
    log_monitoring "Monitoring processes..."
    
    # PM2 process check
    local pm2_status=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="psygstore-backend") | .pm2_env.status' 2>/dev/null || echo "not_found")
    
    case $pm2_status in
        "online")
            echo -e "${GREEN}✅ PM2 Process: Online${NC}"
            
            # Get process metrics
            local cpu_usage=$(pm2 jlist | jq -r '.[] | select(.name=="psygstore-backend") | .monit.cpu' 2>/dev/null || echo "0")
            local memory_usage=$(pm2 jlist | jq -r '.[] | select(.name=="psygstore-backend") | .monit.memory' 2>/dev/null || echo "0")
            local memory_mb=$((memory_usage / 1024 / 1024))
            
            echo -e "${BLUE}📊 Process CPU: ${cpu_usage}%, Memory: ${memory_mb}MB${NC}"
            log_monitoring "Process metrics - CPU: ${cpu_usage}%, Memory: ${memory_mb}MB"
            
            # Alert on high resource usage
            if [ "$(echo "$cpu_usage > 80" | bc -l)" = "1" ]; then
                send_alert "WARNING" "High CPU usage: ${cpu_usage}%" "high_cpu"
            fi
            
            if [ "$memory_mb" -gt 800 ]; then  # 800MB threshold
                send_alert "WARNING" "High memory usage: ${memory_mb}MB" "high_memory"
            fi
            ;;
        "stopped"|"errored"|"stopping")
            send_alert "CRITICAL" "PM2 process is $pm2_status" "pm2_down"
            ;;
        "not_found")
            send_alert "CRITICAL" "PM2 process not found" "pm2_missing"
            ;;
    esac
}

# Log monitoring
monitor_logs() {
    log_monitoring "Checking log files..."
    
    if [ -d "$LOG_DIR" ]; then
        # Check for recent errors
        local recent_errors=$(find $LOG_DIR -name "error-*.log" -mtime -1 -exec grep -c "ERROR" {} \; 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
        
        if [ "$recent_errors" -gt 10 ]; then
            send_alert "WARNING" "High error count in last 24h: $recent_errors" "high_errors"
        fi
        
        # Check log file sizes
        local large_logs=$(find $LOG_DIR -name "*.log" -size +${MAX_LOG_SIZE}M 2>/dev/null)
        if [ -n "$large_logs" ]; then
            send_alert "WARNING" "Large log files detected" "large_logs"
            echo -e "${YELLOW}⚠️  Large log files:${NC}"
            echo "$large_logs"
        fi
        
        # Check log rotation
        local today_logs=$(find $LOG_DIR -name "*$(date +%Y-%m-%d)*.log" 2>/dev/null | wc -l)
        if [ "$today_logs" -eq 0 ]; then
            send_alert "WARNING" "No log files created today - rotation issue?" "no_logs"
        fi
        
        echo -e "${GREEN}✅ Log Monitoring: $recent_errors recent errors${NC}"
    fi
}

# External services monitoring
monitor_external_services() {
    log_monitoring "Checking external services..."
    
    # Nobitex API
    local nobitex_start=$(date +%s%3N)
    if timeout 15 curl -s "https://api.nobitex.ir/market/stats" > /dev/null 2>&1; then
        local nobitex_end=$(date +%s%3N)
        local nobitex_time=$((nobitex_end - nobitex_start))
        echo -e "${GREEN}✅ Nobitex API: Accessible (${nobitex_time}ms)${NC}"
        log_monitoring "Nobitex API response time: ${nobitex_time}ms"
    else
        send_alert "WARNING" "Nobitex API not accessible" "nobitex_down"
    fi
    
    # ZarinPal API (basic connectivity)
    if timeout 10 curl -s "https://api.zarinpal.com" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ ZarinPal API: Accessible${NC}"
    else
        send_alert "WARNING" "ZarinPal API not accessible" "zarinpal_down"
    fi
}

# Security monitoring
monitor_security() {
    log_monitoring "Security monitoring..."
    
    # Check for failed login attempts
    if [ -f "$LOG_DIR/security-$(date +%Y-%m-%d).log" ]; then
        local failed_logins=$(grep -c "Invalid credentials\|Authentication failed" "$LOG_DIR/security-$(date +%Y-%m-%d).log" 2>/dev/null || echo "0")
        
        if [ "$failed_logins" -gt 20 ]; then
            send_alert "WARNING" "High number of failed login attempts: $failed_logins" "failed_logins"
        fi
        
        echo -e "${GREEN}🔒 Security: $failed_logins failed logins today${NC}"
    fi
    
    # Check for suspicious admin activities
    if [ -f "$LOG_DIR/admin-$(date +%Y-%m-%d).log" ]; then
        local admin_actions=$(grep -c "Admin Action" "$LOG_DIR/admin-$(date +%Y-%m-%d).log" 2>/dev/null || echo "0")
        log_monitoring "Admin actions today: $admin_actions"
    fi
}

# Main monitoring function
main() {
    echo "=== PSYGStore Advanced Monitoring - $(date) ==="
    log_monitoring "Starting comprehensive monitoring check"
    
    # Run all monitoring checks
    monitor_performance
    monitor_database
    monitor_processes
    monitor_logs
    monitor_external_services
    monitor_security
    
    # System resources (from health-check.sh)
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [ "$disk_usage" -gt $((100 - MIN_FREE_DISK)) ]; then
        send_alert "CRITICAL" "Low disk space: ${disk_usage}% used" "low_disk"
    fi
    
    if [ "$memory_usage" -gt $((100 - MIN_FREE_MEMORY)) ]; then
        send_alert "CRITICAL" "Low memory: ${memory_usage}% used" "low_memory"
    fi
    
    log_monitoring "Monitoring check completed"
    echo "================================"
}

# Run monitoring
main

# Cleanup old alert threshold entries (older than 24 hours)
if [ -f "$ALERT_THRESHOLD_FILE" ]; then
    local current_time=$(date +%s)
    while IFS=: read -r key timestamp; do
        local time_diff=$((current_time - timestamp))
        if [ $time_diff -lt 86400 ]; then  # Keep entries less than 24 hours old
            echo "$key:$timestamp"
        fi
    done < "$ALERT_THRESHOLD_FILE" > "${ALERT_THRESHOLD_FILE}.tmp"
    mv "${ALERT_THRESHOLD_FILE}.tmp" "$ALERT_THRESHOLD_FILE"
fi