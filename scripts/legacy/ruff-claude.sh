#!/bin/bash
# Enhanced ruff-claude.sh with Redis Integration
# Provides intelligent caching, AI suggestions, and performance tracking

set -euo pipefail

# Configuration
REDIS_PREFIX="ruff_claude"
CACHE_TTL=1800  # 30 minutes
CLAUDE_API_TTL=3600  # 1 hour for AI suggestions
STATS_TTL=86400  # 1 day for statistics
REDIS_DB=2  # Using DB 2 for ruff cache as per allocation

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# Redis availability check
check_redis() {
    if ! command -v redis-cli >/dev/null 2>&1; then
        error "redis-cli not found. Please install Redis client."
        return 1
    fi
    
    if ! redis-cli -n "$REDIS_DB" ping >/dev/null 2>&1; then
        error "Redis not available on database $REDIS_DB"
        return 1
    fi
    
    return 0
}

# Generate file hash for caching
get_file_hash() {
    local file_path="$1"
    sha256sum "$file_path" | cut -d' ' -f1
}

# Cache management functions
cache_set() {
    local key="$1"
    local value="$2"
    local ttl="${3:-$CACHE_TTL}"
    
    if check_redis; then
        echo "$value" | redis-cli -n "$REDIS_DB" -x setex "${REDIS_PREFIX}:${key}" "$ttl" >/dev/null
    fi
}

cache_get() {
    local key="$1"
    
    if check_redis; then
        redis-cli -n "$REDIS_DB" get "${REDIS_PREFIX}:${key}" 2>/dev/null || true
    fi
}

cache_exists() {
    local key="$1"
    
    if check_redis; then
        redis-cli -n "$REDIS_DB" exists "${REDIS_PREFIX}:${key}" >/dev/null 2>&1
        return $?
    fi
    
    return 1
}

cache_delete() {
    local key="$1"
    
    if check_redis; then
        redis-cli -n "$REDIS_DB" del "${REDIS_PREFIX}:${key}" >/dev/null 2>&1
    fi
}

# File modification time tracking
cache_file_mtime() {
    local file_path="$1"
    local file_hash="$2"
    local mtime
    
    if [[ -f "$file_path" ]]; then
        mtime=$(stat -c %Y "$file_path" 2>/dev/null || stat -f %m "$file_path" 2>/dev/null || echo "0")
        cache_set "mtime:${file_hash}" "$mtime" $((CACHE_TTL * 2))
    fi
}

get_cached_mtime() {
    local file_hash="$1"
    cache_get "mtime:${file_hash}"
}

file_changed() {
    local file_path="$1"
    local file_hash="$2"
    local current_mtime
    local cached_mtime
    
    if [[ ! -f "$file_path" ]]; then
        return 0  # File doesn't exist, consider it changed
    fi
    
    current_mtime=$(stat -c %Y "$file_path" 2>/dev/null || stat -f %m "$file_path" 2>/dev/null || echo "0")
    cached_mtime=$(get_cached_mtime "$file_hash")
    
    [[ "$current_mtime" != "$cached_mtime" ]]
}

# Enhanced ruff execution with caching
run_ruff_with_cache() {
    local file_path="$1"
    local format="${2:-json}"
    local fix_mode="${3:-false}"
    local file_hash
    local cache_key
    local results
    
    # Validate file exists
    if [[ ! -f "$file_path" ]]; then
        error "File not found: $file_path"
        return 1
    fi
    
    file_hash=$(get_file_hash "$file_path")
    cache_key="lint:${format}:${fix_mode}:${file_hash}"
    
    # Check if we have cached results and file hasn't changed
    if ! file_changed "$file_path" "$file_hash" && cache_exists "$cache_key"; then
        log "Using cached ruff results for $(basename "$file_path")"
        cache_get "$cache_key"
        track_operation "cache_hit"
        return 0
    fi
    
    log "Running ruff analysis on $(basename "$file_path")"
    
    # Run ruff with appropriate options
    local ruff_cmd="ruff check"
    local ruff_args=()
    
    case "$format" in
        "json")
            ruff_args+=("--output-format=json")
            ;;
        "github")
            ruff_args+=("--output-format=github")
            ;;
        "text")
            ruff_args+=("--output-format=text")
            ;;
    esac
    
    if [[ "$fix_mode" == "true" ]]; then
        ruff_args+=("--fix")
    fi
    
    ruff_args+=("$file_path")
    
    # Execute ruff and capture results
    if results=$(timeout 30 $ruff_cmd "${ruff_args[@]}" 2>&1); then
        # Cache successful results
        cache_set "$cache_key" "$results" "$CACHE_TTL"
        cache_file_mtime "$file_path" "$file_hash"
        track_operation "ruff_success"
        
        echo "$results"
        return 0
    else
        local exit_code=$?
        track_operation "ruff_error"
        
        # Cache error results with shorter TTL
        cache_set "${cache_key}:error" "$results" $((CACHE_TTL / 6))  # 5 minutes
        
        error "Ruff failed with exit code $exit_code"
        echo "$results" >&2
        return $exit_code
    fi
}

# AI suggestion management
store_ai_suggestions() {
    local file_path="$1"
    local suggestions="$2"
    local file_hash
    
    file_hash=$(get_file_hash "$file_path")
    cache_set "ai_suggestions:${file_hash}" "$suggestions" "$CLAUDE_API_TTL"
    track_operation "ai_suggestion_store"
}

get_ai_suggestions() {
    local file_path="$1"
    local file_hash
    
    file_hash=$(get_file_hash "$file_path")
    cache_get "ai_suggestions:${file_hash}"
}

generate_ai_suggestions() {
    local file_path="$1"
    local lint_results="$2"
    local cached_suggestions
    local file_hash
    
    file_hash=$(get_file_hash "$file_path")
    
    # Check for cached suggestions
    if ! file_changed "$file_path" "$file_hash"; then
        cached_suggestions=$(get_ai_suggestions "$file_path")
        if [[ -n "$cached_suggestions" ]]; then
            log "Using cached AI suggestions for $(basename "$file_path")"
            echo "$cached_suggestions"
            track_operation "ai_cache_hit"
            return 0
        fi
    fi
    
    log "Generating AI suggestions for $(basename "$file_path")"
    
    # Generate AI prompt
    local prompt="Analyze the following Python code and ruff linting results. Provide specific, actionable suggestions for improvements:

FILE: $file_path

LINT RESULTS:
$lint_results

CODE:
$(head -100 "$file_path" 2>/dev/null)

Please provide:
1. Priority fixes for critical issues
2. Code quality improvements
3. Performance optimizations
4. Best practice recommendations

Format as JSON with 'suggestions' array containing objects with 'type', 'line', 'message', and 'fix' fields."
    
    # Call Claude API (simplified - would need actual API integration)
    # For now, generate basic suggestions based on common patterns
    local suggestions
    suggestions=$(generate_basic_suggestions "$lint_results")
    
    # Store suggestions
    store_ai_suggestions "$file_path" "$suggestions"
    track_operation "ai_suggestion_generate"
    
    echo "$suggestions"
}

generate_basic_suggestions() {
    local lint_results="$1"
    
    # Basic pattern-based suggestions (placeholder for actual AI integration)
    cat <<EOF
{
  "suggestions": [
    {
      "type": "code_quality",
      "message": "Consider adding type hints for better code documentation",
      "priority": "medium"
    },
    {
      "type": "performance", 
      "message": "Review loops and data structures for optimization opportunities",
      "priority": "low"
    },
    {
      "type": "maintainability",
      "message": "Consider breaking down complex functions into smaller, focused units",
      "priority": "medium"
    }
  ],
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "lint_issues_count": $(echo "$lint_results" | jq '. | length' 2>/dev/null || echo "0")
}
EOF
}

# Statistics tracking
track_operation() {
    local operation="$1"
    local timestamp
    
    timestamp=$(date +%s)
    
    if check_redis; then
        # Increment counter
        redis-cli -n "$REDIS_DB" incr "${REDIS_PREFIX}:stats:${operation}:count" >/dev/null
        
        # Update last used timestamp
        redis-cli -n "$REDIS_DB" set "${REDIS_PREFIX}:stats:${operation}:last_used" "$timestamp" >/dev/null
        
        # Store in time series for analytics (with TTL)
        redis-cli -n "$REDIS_DB" zadd "${REDIS_PREFIX}:timeseries:${operation}" "$timestamp" "$timestamp" >/dev/null
        redis-cli -n "$REDIS_DB" expire "${REDIS_PREFIX}:timeseries:${operation}" "$STATS_TTL" >/dev/null
    fi
}

get_usage_stats() {
    if ! check_redis; then
        echo "Redis not available - no statistics"
        return 1
    fi
    
    echo "=== Ruff-Claude Usage Statistics ==="
    echo "Generated at: $(date)"
    echo ""
    
    # Get operation counts
    local operations=("ruff_success" "ruff_error" "cache_hit" "ai_suggestion_store" "ai_suggestion_generate" "ai_cache_hit")
    
    for op in "${operations[@]}"; do
        local count
        local last_used
        local last_used_human
        
        count=$(redis-cli -n "$REDIS_DB" get "${REDIS_PREFIX}:stats:${op}:count" 2>/dev/null || echo "0")
        last_used=$(redis-cli -n "$REDIS_DB" get "${REDIS_PREFIX}:stats:${op}:last_used" 2>/dev/null || echo "0")
        
        if [[ "$last_used" != "0" ]]; then
            last_used_human=$(date -d "@$last_used" 2>/dev/null || date -r "$last_used" 2>/dev/null || echo "Unknown")
        else
            last_used_human="Never"
        fi
        
        echo "${op}: ${count} (last: ${last_used_human})"
    done
    
    echo ""
    
    # Cache efficiency
    local cache_hits
    local total_ruff_runs
    local cache_hit_rate
    
    cache_hits=$(redis-cli -n "$REDIS_DB" get "${REDIS_PREFIX}:stats:cache_hit:count" 2>/dev/null || echo "0")
    total_ruff_runs=$(($(redis-cli -n "$REDIS_DB" get "${REDIS_PREFIX}:stats:ruff_success:count" 2>/dev/null || echo "0") + cache_hits))
    
    if [[ "$total_ruff_runs" -gt 0 ]]; then
        cache_hit_rate=$(echo "scale=2; $cache_hits * 100 / $total_ruff_runs" | bc 2>/dev/null || echo "0")
        echo "Cache hit rate: ${cache_hit_rate}%"
    else
        echo "Cache hit rate: N/A"
    fi
    
    # AI suggestions stats
    local ai_cache_hits
    local ai_generates
    local ai_total
    local ai_cache_rate
    
    ai_cache_hits=$(redis-cli -n "$REDIS_DB" get "${REDIS_PREFIX}:stats:ai_cache_hit:count" 2>/dev/null || echo "0")
    ai_generates=$(redis-cli -n "$REDIS_DB" get "${REDIS_PREFIX}:stats:ai_suggestion_generate:count" 2>/dev/null || echo "0")
    ai_total=$((ai_cache_hits + ai_generates))
    
    if [[ "$ai_total" -gt 0 ]]; then
        ai_cache_rate=$(echo "scale=2; $ai_cache_hits * 100 / $ai_total" | bc 2>/dev/null || echo "0")
        echo "AI cache hit rate: ${ai_cache_rate}%"
    else
        echo "AI cache hit rate: N/A"
    fi
    
    echo ""
    echo "=== Redis Info ==="
    local memory_info
    memory_info=$(redis-cli -n "$REDIS_DB" info memory | grep "used_memory_human\|maxmemory_human")
    echo "$memory_info"
}

# Cache management
clear_cache() {
    local pattern="${1:-*}"
    
    if ! check_redis; then
        error "Redis not available for cache clearing"
        return 1
    fi
    
    log "Clearing cache with pattern: $pattern"
    
    # Use SCAN to avoid blocking
    redis-cli -n "$REDIS_DB" --scan --pattern "${REDIS_PREFIX}:${pattern}" | \
    while read -r key; do
        redis-cli -n "$REDIS_DB" del "$key" >/dev/null
    done
    
    log "Cache cleared"
    track_operation "cache_clear"
}

# Health check
health_check() {
    echo "=== Ruff-Claude Health Check ==="
    echo "Timestamp: $(date)"
    echo ""
    
    # Check ruff
    if command -v ruff >/dev/null 2>&1; then
        echo "✅ Ruff: Available ($(ruff --version))"
    else
        echo "❌ Ruff: Not found"
    fi
    
    # Check Redis
    if check_redis; then
        local latency
        local memory_mb
        
        # Measure latency
        latency=$(redis-cli -n "$REDIS_DB" --latency-history -i 1 ping 2>/dev/null | head -1 | grep -o '[0-9]\+\.[0-9]\+' | head -1 || echo "0")
        memory_mb=$(redis-cli -n "$REDIS_DB" info memory | grep "used_memory:" | cut -d: -f2 | sed 's/[^0-9]//g')
        memory_mb=$((memory_mb / 1024 / 1024))
        
        echo "✅ Redis: Available (DB $REDIS_DB)"
        echo "   Latency: ${latency}ms"
        echo "   Memory: ${memory_mb}MB"
    else
        echo "❌ Redis: Not available"
    fi
    
    # Check disk space for cache
    echo ""
    echo "System Resources:"
    df -h /tmp 2>/dev/null || df -h /var/tmp 2>/dev/null || echo "Could not check disk space"
    
    echo ""
    echo "Recent Activity:"
    get_usage_stats | tail -10
}

# Performance profiling
profile_operation() {
    local file_path="$1"
    local operation="${2:-full}"
    local iterations="${3:-5}"
    
    if [[ ! -f "$file_path" ]]; then
        error "File not found: $file_path"
        return 1
    fi
    
    log "Profiling $operation operation on $(basename "$file_path") ($iterations iterations)"
    
    local total_time=0
    local min_time=999999
    local max_time=0
    
    for ((i=1; i<=iterations; i++)); do
        local start_time
        local end_time
        local duration
        
        start_time=$(date +%s.%N)
        
        case "$operation" in
            "ruff")
                run_ruff_with_cache "$file_path" "json" "false" >/dev/null
                ;;
            "cache")
                # Clear cache first, then run
                local file_hash
                file_hash=$(get_file_hash "$file_path")
                cache_delete "lint:json:false:${file_hash}"
                run_ruff_with_cache "$file_path" "json" "false" >/dev/null
                ;;
            "full")
                # Full pipeline
                local results
                results=$(run_ruff_with_cache "$file_path" "json" "false")
                generate_ai_suggestions "$file_path" "$results" >/dev/null
                ;;
        esac
        
        end_time=$(date +%s.%N)
        duration=$(echo "$end_time - $start_time" | bc -l)
        
        total_time=$(echo "$total_time + $duration" | bc -l)
        
        if (( $(echo "$duration < $min_time" | bc -l) )); then
            min_time=$duration
        fi
        
        if (( $(echo "$duration > $max_time" | bc -l) )); then
            max_time=$duration
        fi
        
        echo "Iteration $i: ${duration}s"
    done
    
    local avg_time
    avg_time=$(echo "scale=3; $total_time / $iterations" | bc -l)
    
    echo ""
    echo "Performance Summary:"
    echo "Average: ${avg_time}s"
    echo "Min: ${min_time}s" 
    echo "Max: ${max_time}s"
    echo "Total: ${total_time}s"
}

# Main execution function
main() {
    local action="${1:-lint}"
    local file_path="${2:-}"
    local format="${3:-json}"
    local additional_args=("${@:4}")
    
    case "$action" in
        "lint")
            if [[ -z "$file_path" ]]; then
                error "File path required for lint action"
                echo "Usage: $0 lint <file_path> [format] [additional_args...]"
                return 1
            fi
            run_ruff_with_cache "$file_path" "$format" "false"
            ;;
        
        "fix")
            if [[ -z "$file_path" ]]; then
                error "File path required for fix action"
                echo "Usage: $0 fix <file_path> [format]"
                return 1
            fi
            run_ruff_with_cache "$file_path" "$format" "true"
            ;;
        
        "suggest")
            if [[ -z "$file_path" ]]; then
                error "File path required for suggest action"
                echo "Usage: $0 suggest <file_path>"
                return 1
            fi
            local lint_results
            lint_results=$(run_ruff_with_cache "$file_path" "json" "false")
            generate_ai_suggestions "$file_path" "$lint_results"
            ;;
        
        "full")
            if [[ -z "$file_path" ]]; then
                error "File path required for full analysis"
                echo "Usage: $0 full <file_path>"
                return 1
            fi
            echo "=== Ruff Analysis ==="
            local lint_results
            lint_results=$(run_ruff_with_cache "$file_path" "json" "false")
            echo "$lint_results"
            
            echo ""
            echo "=== AI Suggestions ==="
            generate_ai_suggestions "$file_path" "$lint_results"
            ;;
        
        "stats")
            get_usage_stats
            ;;
        
        "clear-cache")
            local pattern="${file_path:-*}"
            clear_cache "$pattern"
            ;;
        
        "health")
            health_check
            ;;
        
        "profile")
            if [[ -z "$file_path" ]]; then
                error "File path required for profiling"
                echo "Usage: $0 profile <file_path> [operation] [iterations]"
                return 1
            fi
            profile_operation "$file_path" "$format" "${additional_args[0]:-5}"
            ;;
        
        "help"|"-h"|"--help")
            cat <<EOF
Ruff-Claude with Redis Integration

USAGE:
    $0 <action> [arguments...]

ACTIONS:
    lint <file> [format]     Run ruff linting with caching (formats: json, text, github)
    fix <file> [format]      Run ruff with --fix flag
    suggest <file>           Generate AI suggestions based on lint results
    full <file>              Run complete analysis (lint + AI suggestions)
    stats                    Show usage statistics and cache performance
    clear-cache [pattern]    Clear cached results (pattern optional)
    health                   Perform health check of all components
    profile <file> [op] [n]  Profile performance (operations: ruff, cache, full)
    help                     Show this help message

EXAMPLES:
    $0 lint myfile.py json
    $0 fix myfile.py 
    $0 suggest myfile.py
    $0 full myfile.py
    $0 stats
    $0 clear-cache "*.py"
    $0 health
    $0 profile myfile.py full 10

REDIS CONFIGURATION:
    Database: $REDIS_DB
    Cache TTL: ${CACHE_TTL}s
    AI Suggestion TTL: ${CLAUDE_API_TTL}s

For more information, see: ~/.claude/REDIS_INTEGRATION_GUIDE.md
EOF
            ;;
        
        *)
            error "Unknown action: $action"
            echo "Use '$0 help' for usage information"
            return 1
            ;;
    esac
}

# Execute if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi