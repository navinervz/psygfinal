#!/bin/bash

# PSYGStore Advanced Health Check Script
set -e

# Load configuration from environment or use defaults
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

PROJECT_DIR="/var/www/psygstore.com/backend"
LOG_FILE="/var/log/psygstore-health.log"
ALERT_THRESHOLD_FILE="/tmp/psygstore-health-alerts.tmp"

echo "=== PSYGStore Backend Health Check - $(date) ==="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to log with timestamp
log_with_timestamp() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Function to send alert (can be extended to send to Telegram/Email)
send_alert() {
    local message="$1"
    local severity="${2:-WARNING}"
    local alert_key="${3:-general}"
    
    log_with_timestamp "ALERT: $message"
    
    # Prevent spam alerts (same alert within 1 hour)
    if [ -f "$ALERT_THRESHOLD_FILE" ] && grep -q "$alert_key" "$ALERT_THRESHOLD_FILE"; then
        local last_alert=$(grep "$alert_key" "$ALERT_THRESHOLD_FILE" | cut -d: -f2)
        local current_time=$(date +%s)
        local time_diff=$((current_time - last_alert))
        
        if [ $time_diff -lt 3600 ]; then  # 1 hour
            return 0  # Skip duplicate alert
        fi
    fi
    
    # Update alert threshold file
    grep -v "$alert_key" "$ALERT_THRESHOLD_FILE" 2>/dev/null > "${ALERT_THRESHOLD_FILE}.tmp" || true
    echo "$alert_key:$(date +%s)" >> "${ALERT_THRESHOLD_FILE}.tmp"
    mv "${ALERT_THRESHOLD_FILE}.tmp" "$ALERT_THRESHOLD_FILE"
    
    # Send actual alert if configured
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        local emoji="⚠️"
        case $severity in
            "CRITICAL") emoji="🚨" ;;
            "WARNING") emoji="⚠️" ;;
            "INFO") emoji="ℹ️" ;;
        esac
        
        curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
             -d "chat_id=$TELEGRAM_CHAT_ID" \
             -d "text=$emoji PSYGStore Alert: $message" \
             -d "parse_mode=Markdown" > /dev/null 2>&1 || true
    fi
    
    # Call Node.js alert service if backend is running
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        curl -s -X POST http://localhost:3000/api/admin/alerts \
             -H "Content-Type: application/json" \
             -d "{\"severity\":\"$severity\",\"title\":\"Health Check Alert\",\"message\":\"$message\",\"source\":\"health-check\"}" > /dev/null 2>&1 || true
    fi
}

# Enhanced backend health check with response time
check_backend_health() {
    local start_time=$(date +%s%3N)
    local HEALTH_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/health -o /tmp/health_response.json)
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    if [ "$HEALTH_RESPONSE" = "200" ]; then
        echo -e "${GREEN}✅ Backend API: Running (${response_time}ms)${NC}"
        log_with_timestamp "Backend API: Healthy (${response_time}ms)"
        
        # Check response time
        if [ "$response_time" -gt "$MAX_RESPONSE_TIME" ]; then
            send_alert "Backend response time high: ${response_time}ms" "WARNING" "slow_response"
        fi
    else
        echo -e "${RED}❌ Backend API: Not responding${NC}"
        log_with_timestamp "Backend API: Not responding (HTTP: $HEALTH_RESPONSE)"
        send_alert "Backend API is down" "CRITICAL" "api_down"
        
        echo "Attempting to restart PM2..."
        pm2 restart psygstore-backend
        sleep 10
        
        # Check again
        local RETRY_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/health -o /dev/null)
        if [ "$RETRY_RESPONSE" = "200" ]; then
            echo -e "${GREEN}✅ Backend API: Restarted successfully${NC}"
            log_with_timestamp "Backend API: Restarted successfully"
            send_alert "Backend API restarted successfully" "INFO" "api_restart_success"
        else
            echo -e "${RED}❌ Backend API: Restart failed${NC}"
            log_with_timestamp "Backend API: Restart failed"
            send_alert "Backend API restart failed - manual intervention required" "CRITICAL" "api_restart_failed"
            pm2 logs psygstore-backend --lines 20
        fi
    fi
}

# Enhanced database check
check_database() {
    local db_start=$(date +%s%3N)
    if timeout 10 mysql -h localhost -u xsblbatq_psygstore -pSample@369963 \
        -e "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM orders;" \
        xsblbatq_psygstore > /tmp/db_check.out 2>&1; then
        
        local db_end=$(date +%s%3N)
        local db_time=$((db_end - db_start))
        
        echo -e "${GREEN}✅ Database: Connected (${db_time}ms)${NC}"
        log_with_timestamp "Database connection time: ${db_time}ms"
        
        # Check slow queries
        if [ "$db_time" -gt 3000 ]; then  # 3 seconds
            send_alert "Database queries are slow: ${db_time}ms" "WARNING" "slow_db"
        fi
        
        # Check table counts for anomalies
        local user_count=$(grep -A1 "COUNT" /tmp/db_check.out | head -2 | tail -1)
        local order_count=$(grep -A1 "COUNT" /tmp/db_check.out | tail -1)
        
        log_with_timestamp "Database stats - Users: $user_count, Orders: $order_count"
        
    else
        echo -e "${RED}❌ Database: Connection failed${NC}"
        log_with_timestamp "Database: Connection failed"
        send_alert "Database connection failed" "CRITICAL" "db_down"
        return 1
    fi
    
    rm -f /tmp/db_check.out
}

# Check external APIs
check_external_apis() {
    # Nobitex API check
    local nobitex_start=$(date +%s%3N)
    if timeout 15 curl -s "https://api.nobitex.ir/market/stats" > /dev/null 2>&1; then
        local nobitex_end=$(date +%s%3N)
        local nobitex_time=$((nobitex_end - nobitex_start))
        echo -e "${GREEN}✅ Nobitex API: Accessible (${nobitex_time}ms)${NC}"
        log_with_timestamp "Nobitex API response time: ${nobitex_time}ms"
        
        if [ "$nobitex_time" -gt 10000 ]; then  # 10 seconds
            send_alert "Nobitex API is slow: ${nobitex_time}ms" "WARNING" "nobitex_slow"
        fi
    else
        echo -e "${RED}❌ Nobitex API: Not accessible${NC}"
        send_alert "Nobitex API not accessible - price updates may fail" "WARNING" "nobitex_down"
    fi
    
    # ZarinPal API check
    if timeout 10 curl -s "https://api.zarinpal.com" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ ZarinPal API: Accessible${NC}"
    else
        echo -e "${YELLOW}⚠️  ZarinPal API: Not accessible${NC}"
        send_alert "ZarinPal API not accessible - payments may fail" "WARNING" "zarinpal_down"
    fi
}

# Check SSL certificate expiry
check_ssl_certificate() {
    if command -v openssl &> /dev/null; then
        local SSL_CHECK=$(timeout 10 openssl s_client -connect psygstore.com:443 -servername psygstore.com < /dev/null 2>/dev/null | grep "Verify return code")
        if echo "$SSL_CHECK" | grep -q "Verify return code: 0"; then
            echo -e "${GREEN}✅ SSL Certificate: Valid${NC}"
            
            # Check SSL expiration
            local SSL_EXPIRY=$(timeout 10 openssl s_client -connect psygstore.com:443 -servername psygstore.com < /dev/null 2>/dev/null | openssl x509 -noout -dates | grep "notAfter" | cut -d= -f2)
            if [ -n "$SSL_EXPIRY" ]; then
                local EXPIRY_TIMESTAMP=$(date -d "$SSL_EXPIRY" +%s)
                local CURRENT_TIMESTAMP=$(date +%s)
                local DAYS_UNTIL_EXPIRY=$(( (EXPIRY_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
                
                if [ $DAYS_UNTIL_EXPIRY -lt 7 ]; then
                    echo -e "${RED}❌ SSL Certificate: Expires in $DAYS_UNTIL_EXPIRY days${NC}"
                    send_alert "SSL certificate expires in $DAYS_UNTIL_EXPIRY days" "CRITICAL" "ssl_expiry"
                elif [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
                    echo -e "${YELLOW}⚠️  SSL Certificate: Expires in $DAYS_UNTIL_EXPIRY days${NC}"
                    send_alert "SSL certificate expires in $DAYS_UNTIL_EXPIRY days" "WARNING" "ssl_expiry_warning"
                else
                    echo -e "${GREEN}✅ SSL Certificate: Valid for $DAYS_UNTIL_EXPIRY days${NC}"
                fi
            fi
        else
            echo -e "${YELLOW}⚠️  SSL Certificate: Verification failed${NC}"
            send_alert "SSL certificate verification failed" "WARNING" "ssl_invalid"
        fi
    fi
}

# Check system resources
check_system_resources() {
    # Disk space check
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    local free_disk=$((100 - disk_usage))
    
    if [ $free_disk -lt $MIN_FREE_DISK ]; then
        echo -e "${RED}❌ Disk Space: ${disk_usage}% used (Critical)${NC}"
        send_alert "Disk space critical: ${disk_usage}% used, only ${free_disk}% free" "CRITICAL" "low_disk"
    elif [ $free_disk -lt $((MIN_FREE_DISK * 2)) ]; then
        echo -e "${YELLOW}⚠️  Disk Space: ${disk_usage}% used (Warning)${NC}"
        send_alert "Disk space warning: ${disk_usage}% used" "WARNING" "disk_warning"
    else
        echo -e "${GREEN}✅ Disk Space: ${disk_usage}% used${NC}"
    fi
    
    # Memory check
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    local free_memory=$((100 - memory_usage))
    
    if [ $free_memory -lt $MIN_FREE_MEMORY ]; then
        echo -e "${RED}❌ Memory: ${memory_usage}% used (Critical)${NC}"
        send_alert "Memory usage critical: ${memory_usage}% used" "CRITICAL" "low_memory"
    elif [ $free_memory -lt $((MIN_FREE_MEMORY * 2)) ]; then
        echo -e "${YELLOW}⚠️  Memory: ${memory_usage}% used (Warning)${NC}"
        send_alert "Memory usage warning: ${memory_usage}% used" "WARNING" "memory_warning"
    else
        echo -e "${GREEN}✅ Memory: ${memory_usage}% used${NC}"
    fi
}

# Check log files
check_log_files() {
    local LOG_DIR="$PROJECT_DIR/logs"
    if [ -d "$LOG_DIR" ]; then
        # Check for large log files
        local large_logs=$(find $LOG_DIR -name "*.log" -size +${MAX_LOG_SIZE}M 2>/dev/null)
        if [ -n "$large_logs" ]; then
            echo -e "${YELLOW}⚠️  Large log files detected:${NC}"
            echo "$large_logs"
            send_alert "Large log files detected (>${MAX_LOG_SIZE}MB)" "WARNING" "large_logs"
        fi
        
        # Check recent errors
        local recent_errors=$(find $LOG_DIR -name "error-*.log" -mtime -1 -exec grep -c "ERROR" {} \; 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
        if [ "$recent_errors" -gt 50 ]; then
            send_alert "High error count in last 24h: $recent_errors errors" "WARNING" "high_errors"
        fi
        
        echo -e "${GREEN}✅ Log Files: $recent_errors recent errors${NC}"
    fi
}

# Main execution
check_backend_health
check_database
check_external_apis
check_ssl_certificate
check_system_resources
check_log_files
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Backend API: Running${NC}"
    log_with_timestamp "Backend API: Healthy"
else
    echo -e "${RED}❌ Backend API: Not responding${NC}"
    log_with_timestamp "Backend API: Not responding (HTTP: $HEALTH_RESPONSE)"
    send_alert "Backend API is down, attempting restart"
    
    echo "Attempting to restart PM2..."
    pm2 restart psygstore-backend
    sleep 10
    
    # Check again
    RETRY_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:3000/health -o /dev/null)
    if [ "$RETRY_RESPONSE" = "200" ]; then
        echo -e "${GREEN}✅ Backend API: Restarted successfully${NC}"
        log_with_timestamp "Backend API: Restarted successfully"
    else
        echo -e "${RED}❌ Backend API: Restart failed${NC}"
        log_with_timestamp "Backend API: Restart failed"
        send_alert "Backend API restart failed - manual intervention required"
        pm2 logs psygstore-backend --lines 20
    fi
fi

# Check PM2 process
PM2_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="psygstore-backend") | .pm2_env.status' 2>/dev/null || echo "not_found")
if [ "$PM2_STATUS" = "online" ]; then
    echo -e "${GREEN}✅ PM2 Process: Running${NC}"
    log_with_timestamp "PM2 Process: Online"
else
    echo -e "${RED}❌ PM2 Process: Not running${NC}"
    log_with_timestamp "PM2 Process: $PM2_STATUS"
    send_alert "PM2 process is not online: $PM2_STATUS"
fi

# Check database connection
if timeout 10 mysql -h localhost -u xsblbatq_psygstore -pSample@369963 -e "SELECT 1;" xsblbatq_psygstore > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database: Connected${NC}"
    log_with_timestamp "Database: Connected"
else
    echo -e "${RED}❌ Database: Connection failed${NC}"
    log_with_timestamp "Database: Connection failed"
    send_alert "Database connection failed"
fi

# Check price update service
if [ -f "/tmp/health_response.json" ]; then
    PRICE_SERVICE_STATUS=$(jq -r '.priceService.isRunning // false' /tmp/health_response.json 2>/dev/null)
    LAST_UPDATE=$(jq -r '.priceService.lastUpdate // "never"' /tmp/health_response.json 2>/dev/null)
    
    if [ "$PRICE_SERVICE_STATUS" = "true" ]; then
        echo -e "${GREEN}✅ Price Service: Running (Last update: $LAST_UPDATE)${NC}"
        log_with_timestamp "Price Service: Running"
    else
        echo -e "${RED}❌ Price Service: Not running${NC}"
        log_with_timestamp "Price Service: Not running"
        send_alert "Price update service is not running"
    fi
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    echo -e "${RED}❌ Disk Space: ${DISK_USAGE}% used (Critical)${NC}"
    send_alert "Disk space critical: ${DISK_USAGE}% used"
elif [ $DISK_USAGE -gt 80 ]; then
    echo -e "${YELLOW}⚠️  Disk Space: ${DISK_USAGE}% used (Warning)${NC}"
    log_with_timestamp "Disk space warning: ${DISK_USAGE}% used"
else
    echo -e "${GREEN}✅ Disk Space: ${DISK_USAGE}% used${NC}"
fi

# Check memory usage
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEMORY_USAGE -gt 90 ]; then
    echo -e "${RED}❌ Memory: ${MEMORY_USAGE}% used (Critical)${NC}"
    send_alert "Memory usage critical: ${MEMORY_USAGE}% used"
elif [ $MEMORY_USAGE -gt 80 ]; then
    echo -e "${YELLOW}⚠️  Memory: ${MEMORY_USAGE}% used (Warning)${NC}"
    log_with_timestamp "Memory usage warning: ${MEMORY_USAGE}% used"
else
    echo -e "${GREEN}✅ Memory: ${MEMORY_USAGE}% used${NC}"
fi

# Check log file sizes and rotation
LOG_DIR="$PROJECT_DIR/logs"
if [ -d "$LOG_DIR" ]; then
    LOG_SIZE=$(du -sh $LOG_DIR | cut -f1)
    echo -e "${GREEN}📝 Log Directory Size: ${LOG_SIZE}${NC}"
    
    # Check for large log files
    LARGE_LOGS=$(find $LOG_DIR -name "*.log" -size +100M)
    if [ -n "$LARGE_LOGS" ]; then
        echo -e "${YELLOW}⚠️  Large log files found:${NC}"
        echo "$LARGE_LOGS"
        log_with_timestamp "Large log files detected"
    fi
    
    # Check log rotation
    RECENT_LOGS=$(find $LOG_DIR -name "*.log" -mtime -1 | wc -l)
    if [ $RECENT_LOGS -eq 0 ]; then
        echo -e "${YELLOW}⚠️  No recent log files (log rotation issue?)${NC}"
        log_with_timestamp "No recent log files found"
    fi
fi

# Check Node.js process health
NODE_PROCESSES=$(pgrep -f "node.*server.js" | wc -l)
if [ $NODE_PROCESSES -gt 0 ]; then
    echo -e "${GREEN}✅ Node.js Processes: $NODE_PROCESSES running${NC}"
else
    echo -e "${RED}❌ Node.js Processes: None found${NC}"
    send_alert "No Node.js processes found"
fi

# Check external API connectivity (Nobitex)
if timeout 10 curl -s "https://api.nobitex.ir/market/stats" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Nobitex API: Accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Nobitex API: Not accessible${NC}"
    log_with_timestamp "Nobitex API not accessible"
fi

# Check SSL certificate (if applicable)
if command -v openssl &> /dev/null; then
    SSL_CHECK=$(timeout 10 openssl s_client -connect psygstore.com:443 -servername psygstore.com < /dev/null 2>/dev/null | grep "Verify return code")
    if echo "$SSL_CHECK" | grep -q "Verify return code: 0"; then
        echo -e "${GREEN}✅ SSL Certificate: Valid${NC}"
        
        # Check SSL expiration
        SSL_EXPIRY=$(timeout 10 openssl s_client -connect psygstore.com:443 -servername psygstore.com < /dev/null 2>/dev/null | openssl x509 -noout -dates | grep "notAfter" | cut -d= -f2)
        if [ -n "$SSL_EXPIRY" ]; then
            EXPIRY_TIMESTAMP=$(date -d "$SSL_EXPIRY" +%s)
            CURRENT_TIMESTAMP=$(date +%s)
            DAYS_UNTIL_EXPIRY=$(( (EXPIRY_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))
            
            if [ $DAYS_UNTIL_EXPIRY -lt 7 ]; then
                echo -e "${RED}❌ SSL Certificate: Expires in $DAYS_UNTIL_EXPIRY days${NC}"
                send_alert "SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
            elif [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
                echo -e "${YELLOW}⚠️  SSL Certificate: Expires in $DAYS_UNTIL_EXPIRY days${NC}"
                log_with_timestamp "SSL certificate expires in $DAYS_UNTIL_EXPIRY days"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  SSL Certificate: Check required${NC}"
        log_with_timestamp "SSL certificate verification failed"
    fi
fi

# Performance metrics
if command -v node &> /dev/null && [ -f "$PROJECT_DIR/dist/server.js" ]; then
    # Check if we can get performance metrics from the health endpoint
    if [ -f "/tmp/health_response.json" ]; then
        UPTIME=$(jq -r '.uptime // 0' /tmp/health_response.json 2>/dev/null)
        if [ "$UPTIME" != "0" ] && [ "$UPTIME" != "null" ]; then
            UPTIME_HOURS=$(echo "$UPTIME / 3600" | bc -l | xargs printf "%.1f")
            echo -e "${GREEN}📊 Backend Uptime: ${UPTIME_HOURS} hours${NC}"
        fi
    fi
fi

# Cleanup temp files
rm -f /tmp/health_response.json

log_with_timestamp "Health check completed"
echo "================================"