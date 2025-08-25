#!/bin/bash
# Redis Health Monitor for AI Agents

REDIS_DB_COUNT=10
ALERT_MEMORY_THRESHOLD=90
ALERT_LATENCY_THRESHOLD=10

check_redis_health() {
    local overall_status="healthy"
    local issues=()
    
    echo "=== Redis Health Check Report ==="
    echo "Timestamp: $(date)"
    echo ""
    
    # Basic connectivity
    if redis-cli ping >/dev/null 2>&1; then
        echo "✅ Redis connectivity: OK"
        
        # Check memory usage
        local memory_info
        memory_info=$(redis-cli info memory)
        local used_memory
        used_memory=$(echo "$memory_info" | grep "used_memory:" | cut -d: -f2 | tr -d '\r')
        local max_memory
        max_memory=$(echo "$memory_info" | grep "maxmemory:" | cut -d: -f2 | tr -d '\r')
        
        if [[ "$max_memory" -gt 0 ]]; then
            local memory_percent
            memory_percent=$((used_memory * 100 / max_memory))
            echo "📊 Memory usage: ${memory_percent}%"
            
            if [[ "$memory_percent" -gt "$ALERT_MEMORY_THRESHOLD" ]]; then
                echo "⚠️  High memory usage warning: ${memory_percent}%"
                issues+=("High memory usage: ${memory_percent}%")
                overall_status="degraded"
            fi
        fi
        
        # Check latency
        local latency
        latency=$(redis-cli --latency-history -i 1 ping 2>/dev/null | head -1 | grep -o '[0-9]\+\.[0-9]\+' | head -1 || echo "0")
        echo "⚡ Latency: ${latency}ms"
        
        if (( $(echo "$latency > $ALERT_LATENCY_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
            echo "⚠️  High latency warning: ${latency}ms"
            issues+=("High latency: ${latency}ms")
            overall_status="degraded"
        fi
        
        # Check database availability
        echo ""
        echo "Database Status:"
        for ((db=0; db<REDIS_DB_COUNT; db++)); do
            if redis-cli -n "$db" ping >/dev/null 2>&1; then
                local key_count
                key_count=$(redis-cli -n "$db" dbsize)
                echo "  DB $db: ✅ ($key_count keys)"
            else
                echo "  DB $db: ❌"
                issues+=("Database $db unavailable")
                overall_status="unhealthy"
            fi
        done
        
    else
        echo "❌ Redis connectivity: FAILED"
        issues+=("Redis server not accessible")
        overall_status="unhealthy"
    fi
    
    echo ""
    echo "=== Summary ==="
    echo "Overall Status: $overall_status"
    
    if [[ ${#issues[@]} -gt 0 ]]; then
        echo "Issues:"
        printf '  - %s\n' "${issues[@]}"
    else
        echo "No issues detected"
    fi
    
    # Store health check result
    if redis-cli ping >/dev/null 2>&1; then
        redis-cli -n 8 hset "system:health:redis" \
            "timestamp" "$(date +%s)" \
            "status" "$overall_status" \
            "issues" "$(IFS=','; echo "${issues[*]}")" \
            >/dev/null
        redis-cli -n 8 expire "system:health:redis" 300 >/dev/null
    fi
    
    # Return appropriate exit code
    case "$overall_status" in
        "healthy") exit 0 ;;
        "degraded") exit 1 ;;
        "unhealthy") exit 2 ;;
    esac
}

case "${1:-check}" in
    "check"|"health")
        check_redis_health
        ;;
    "status")
        if redis-cli ping >/dev/null 2>&1; then
            redis-cli -n 8 hgetall "system:health:redis"
        else
            echo "Redis not available"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {check|health|status}"
        echo "  check/health: Perform health check"
        echo "  status: Get last health check result"
        exit 1
        ;;
esac
